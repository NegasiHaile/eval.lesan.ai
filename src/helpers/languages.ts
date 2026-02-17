import { languages } from "@/constants/iso1-iso3-languages";
import { LanguageTypes } from "@/types/languages";

export const findLanguage = (query: string): LanguageTypes | undefined => {
  return languages.find(
    (lang) =>
      lang.iso_name === query ||
      lang.iso_639_1 === query ||
      lang.iso_639_3 === query
  );
};
