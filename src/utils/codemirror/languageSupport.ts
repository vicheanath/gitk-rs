import { Extension } from "@codemirror/state";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

export async function loadLanguageExtensionForPath(
  filePath?: string | null
): Promise<Extension> {
  if (!filePath) {
    return [];
  }

  const fileName = filePath.split("/").pop() ?? filePath;

  const description =
    LanguageDescription.matchFilename(languages, fileName) ||
    LanguageDescription.matchFilename(languages, filePath);

  if (!description) {
    return [];
  }

  try {
    return await description.load();
  } catch {
    return [];
  }
}
