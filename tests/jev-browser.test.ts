import test from "node:test";
import assert from "node:assert/strict";
import { createJEVBrowserClient } from "../src/integrations/jev-browser.js";

test("JEV client is unavailable when required credentials are absent", () => {
  const previousTypesafe = process.env.TYPESAFE_API_KEY;
  const previousText = process.env.TEXT_MODEL_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.TEXT_MODEL_API_KEY;
  try {
    assert.equal(createJEVBrowserClient("http://127.0.0.1:4173"), undefined);
  } finally {
    if (previousTypesafe === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = previousTypesafe;
    if (previousText === undefined) delete process.env.TEXT_MODEL_API_KEY;
    else process.env.TEXT_MODEL_API_KEY = previousText;
  }
});

test("JEV client is unavailable for a non-loopback preview URL", () => {
  const previousTypesafe = process.env.TYPESAFE_API_KEY;
  const previousText = process.env.TEXT_MODEL_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-only";
  process.env.TEXT_MODEL_API_KEY = "test-only";
  try {
    assert.equal(createJEVBrowserClient("https://cidealeads.com"), undefined);
  } finally {
    if (previousTypesafe === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = previousTypesafe;
    if (previousText === undefined) delete process.env.TEXT_MODEL_API_KEY;
    else process.env.TEXT_MODEL_API_KEY = previousText;
  }
});

test("JEV client can be configured only for a loopback preview with required credentials", () => {
  const previousTypesafe = process.env.TYPESAFE_API_KEY;
  const previousText = process.env.TEXT_MODEL_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-only";
  process.env.TEXT_MODEL_API_KEY = "test-only";
  try {
    assert.equal(typeof createJEVBrowserClient("http://127.0.0.1:4173")?.execute, "function");
  } finally {
    if (previousTypesafe === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = previousTypesafe;
    if (previousText === undefined) delete process.env.TEXT_MODEL_API_KEY;
    else process.env.TEXT_MODEL_API_KEY = previousText;
  }
});
