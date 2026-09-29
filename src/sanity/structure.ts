import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.documentTypeListItem("page").title("Pages"),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !["page"].includes(item.getId() ?? ""),
      ),
    ]);
