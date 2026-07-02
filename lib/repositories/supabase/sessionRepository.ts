import "server-only";
import { supabase } from "@/lib/db/supabase";
import type { SessionRecord, SessionRepository } from "../types";

function mapRow(row: {
  token_hash: string;
  user_id: string;
  expires_at: number;
}): SessionRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    expiresAt: row.expires_at,
  };
}

export const supabaseSessionRepository: SessionRepository = {
  async create({ userId, tokenHash, expiresAtMs }) {
    const { error } = await supabase.from("sessions").insert([
      {
        token_hash: tokenHash,
        user_id: userId,
        expires_at: expiresAtMs,
        created_at: Date.now(),
      },
    ]);

    if (error) throw error;
  },

  async findByTokenHash(tokenHash) {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("token_hash", tokenHash)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? mapRow(data) : null;
  },

  async deleteByTokenHash(tokenHash) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("token_hash", tokenHash);

    if (error) throw error;
  },

  async deleteExpired(nowMs) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .lte("expires_at", nowMs);

    if (error) throw error;
  },
};
