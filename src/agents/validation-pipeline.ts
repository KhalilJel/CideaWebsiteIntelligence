import type { JEVBrowserClient, BrowserAction, BrowserObservation } from "../integrations/jev-browser.js";
import { runPixelJury, type PixelJuryResult } from "../integrations/pixeljury.js";
import { parseJEVObservations } from "./typesafe-browser.js";

export type ValidationCheckStatus = "passed" | "failed" | "not_ready";

export type ValidationCheck = {
  name: "JEV" | "TypeSafe" | "PixelJury";
  status: ValidationCheckStatus;
  summary: string;
  details?: unknown;
};

export type ValidationPipelineResult = {
  status: "passed" | "failed" | "not_ready";
  checks: ValidationCheck[];
  browserObservations: BrowserObservation[];
  pixelJury?: PixelJuryResult;
};

export type ValidationPipelineDependencies = {
  browser?: JEVBrowserClient;
  pixelJuryRunner?: (url: string) => Promise<PixelJuryResult>;
  pixelJuryAvailable?: boolean;
};

function aggregateStatus(checks: ValidationCheck[]): ValidationPipelineResult["status"] {
  if (checks.some(check => check.status === "failed")) return "failed";
  if (checks.some(check => check.status === "not_ready")) return "not_ready";
  return "passed";
}

export async function runValidationPipeline(
  websiteUrl: string,
  browserActions: BrowserAction[],
  dependencies: ValidationPipelineDependencies = {}
): Promise<ValidationPipelineResult> {
  const checks: ValidationCheck[] = [];
  let browserObservations: BrowserObservation[] = [];

  if (!dependencies.browser) {
    checks.push({
      name: "JEV",
      status: "not_ready",
      summary: "JEV browser client is not configured."
    });
    checks.push({
      name: "TypeSafe",
      status: "not_ready",
      summary: "TypeSafe validation cannot run until JEV observations are available."
    });
  } else {
    try {
      browserObservations = await dependencies.browser.execute(browserActions);
      const failed = browserObservations.filter(observation => observation.result !== "success");
      checks.push({
        name: "JEV",
        status: failed.length ? "failed" : "passed",
        summary: failed.length
          ? `${failed.length} browser validation step(s) did not succeed.`
          : `${browserObservations.length} browser validation step(s) succeeded.`,
        details: failed
      });

      try {
        const validated = parseJEVObservations({ observations: browserObservations });
        checks.push({
          name: "TypeSafe",
          status: "passed",
          summary: `${validated.length} JEV observations passed strict schema validation.`
        });
      } catch (error) {
        checks.push({
          name: "TypeSafe",
          status: "failed",
          summary: "JEV observations failed strict TypeSafe schema validation.",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      checks.push({
        name: "JEV",
        status: "failed",
        summary: "JEV browser validation failed to execute.",
        details: error instanceof Error ? error.message : String(error)
      });
      checks.push({
        name: "TypeSafe",
        status: "not_ready",
        summary: "TypeSafe validation was not run because JEV execution failed."
      });
    }
  }

  const pixelJuryAvailable = dependencies.pixelJuryAvailable ?? process.env.PIXELJURY_ENABLED === "true";
  if (!pixelJuryAvailable && !dependencies.pixelJuryRunner) {
    checks.push({
      name: "PixelJury",
      status: "not_ready",
      summary: "PixelJury is not enabled for this runtime."
    });
  } else {
    try {
      const pixelJury = await (dependencies.pixelJuryRunner ?? runPixelJury)(websiteUrl);
      const blockingFindings = pixelJury.findings.filter(
        finding => finding.severity === "critical" || finding.severity === "high"
      );
      checks.push({
        name: "PixelJury",
        status: blockingFindings.length ? "failed" : "passed",
        summary: blockingFindings.length
          ? `${blockingFindings.length} high-severity visual finding(s) remain.`
          : "No critical or high-severity PixelJury findings remain.",
        details: {
          score: pixelJury.score,
          provider: pixelJury.provider,
          blockingFindings
        }
      });
      return {
        status: aggregateStatus(checks),
        checks,
        browserObservations,
        pixelJury
      };
    } catch (error) {
      checks.push({
        name: "PixelJury",
        status: "failed",
        summary: "PixelJury validation failed to execute.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    status: aggregateStatus(checks),
    checks,
    browserObservations
  };
}
