import "server-only";
import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/db/supabase";
import type { UserRecord, UserRepository } from "../types";

function mapRow(row: {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export const supabaseUserRepository: UserRepository = {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? mapRow(data) : null;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data ? mapRow(data) : null;
  },

  async create({ email, passwordHash }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          id,
          email,
          password_hash: passwordHash,
          created_at: createdAt,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    return mapRow(data);
  },
};
