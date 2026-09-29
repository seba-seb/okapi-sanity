import { defineArrayMember } from "sanity";

import { acceptedTypes } from "../meta";

/** The schema `of` list for a container's slot, straight from meta.ts. */
export function membersFor(container: string) {
  return (acceptedTypes(container) ?? []).map((type) => defineArrayMember({ type }));
}
