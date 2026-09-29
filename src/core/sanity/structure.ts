import type { StructureResolver } from "sanity/structure";

import { SINGLETONS } from "@/schema";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.documentTypeListItem("page").title("Pages"),
      S.divider(),
      ...SINGLETONS.map((type) =>
        S.listItem()
          .id(type)
          .schemaType(type)
          .title(type[0].toUpperCase() + type.slice(1))
          .child(S.document().schemaType(type).documentId(type)),
      ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !["page", ...SINGLETONS].includes(item.getId() ?? ""),
      ),
    ]);
