import randomBytes from "crypto";
import { ApiKeyRepository } from "./repository/api-key.repository";
import { initDb } from "./init";

function seed() {
  initDb();

  const key = `key_${randomBytes.randomBytes(16).toString("hex")}`;
  const name = "Dev Seed Key";

  try {
    ApiKeyRepository.create(key, name);
    console.log("==================================================");
    console.log(" API Key generated successfully!");
    console.log(` Key Name: ${name}`);
    console.log(` API Key:  ${key}`);
    console.log("==================================================");
    console.log("Use it in Bearer Authorization header:");
    console.log(`Authorization: Bearer ${key}`);
  } catch (error) {
    console.error("Failed to seed API key:", error);
  }
}

seed();
