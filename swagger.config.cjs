const fs = require("node:fs");
const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { generateApi } = require("swagger-typescript-api");

const envPath = path.resolve(__dirname, "./.env");
if (fs.existsSync(envPath)) {
  loadEnvFile(envPath);
}

const apiUrl = process.env.NG_APP_API_URL?.trim().replace(/\/+$/, "");

if (!apiUrl) {
  console.error("ОШИБКА: NG_APP_API_URL не найден в .env");
  process.exit(1);
}

const outputDir = path.resolve(
  __dirname,
  "./src/app/core/api/models"
);

async function main() {
  // Удалит и старые DTO, и старые файлы генератора.
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  await generateApi({
    url: `${apiUrl}/swagger/v1/swagger.json`,
    output: outputDir,
    generateClient: false,
    modular: true,
    singleHttpClient: false,
    extractRequestParams: true,
    extractRequestBody: true,
    extractEnums: true,
    generateUnionEnums: true,
    typePrefix: "",
    typeSuffix: "",
    toJS: false,
  });
}

main().catch(error => {
  console.error("Ошибка генерации API:", error);
  process.exitCode = 1;
});
