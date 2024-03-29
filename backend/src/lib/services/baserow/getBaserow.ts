import { BaserowSdk } from "baserow-sdk";

export default function getBaserow() {
  if (!process.env.BASEROW_DATABASE_TOKEN) {
    throw new Error("missing BASEROW_DATABASE_TOKEN");
  }

  return new BaserowSdk(process.env.BASEROW_DATABASE_TOKEN);
}
