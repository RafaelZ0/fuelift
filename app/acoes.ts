"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { registrarErro } from "@/lib/log";

export async function sair(): Promise<void> {
  try {
    await auth.signOut();
  } catch (e) {
    registrarErro("sair", e);
  }
  redirect("/entrar");
}
