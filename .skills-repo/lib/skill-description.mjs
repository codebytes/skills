export function readSkillDescription(text) {
  const folded = text.match(
    /^description:\s*[>|][+-]?\s*\r?\n((?:(?:[ \t]+[^\r\n]*)?\r?\n)*)/m,
  )?.[1]
    ?.replace(/^\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const scalar = text.match(/^description:\s*(?![>|][+-]?\s*$)(.+)$/m)?.[1]?.trim();
  let description = folded ?? scalar;
  if (description?.startsWith('"') && description.endsWith('"')) {
    description = JSON.parse(description);
  } else if (description?.startsWith("'") && description.endsWith("'")) {
    description = description.slice(1, -1).replaceAll("''", "'");
  }
  description = description?.replace(/\s+/g, " ").trim();
  if (!description) throw new Error("Cannot read skill description");
  return description;
}
