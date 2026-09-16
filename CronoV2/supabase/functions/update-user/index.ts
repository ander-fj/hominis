import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem editar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body?.id ?? "");
    const name = String(body?.name ?? "").trim();
    const role = String(body?.role ?? "tecnico");
    const phone = body?.phone ? String(body.phone).trim() : null;
    const active = body?.active !== false;
    const avatar = body?.avatar && typeof body.avatar === "object" ? body.avatar : null;
    const removeAvatar = body?.removeAvatar === true;
    const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!userId || !name) {
      return new Response(JSON.stringify({ error: "ID e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "gestor", "tecnico", "financeiro"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Perfil de acesso inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (avatar) {
      const avatarType = String(avatar.type ?? "");
      const avatarData = String(avatar.data ?? "");
      if (!allowedAvatarTypes.includes(avatarType) || !avatarData) {
        return new Response(JSON.stringify({ error: "Imagem de avatar inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (Math.ceil((avatarData.length * 3) / 4) > 2097152) {
        return new Response(JSON.stringify({ error: "A imagem deve ter no máximo 2 MB" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let avatarPath: string | null | undefined = undefined;

    if (removeAvatar) {
      avatarPath = null;
    } else if (avatar) {
      try {
        const binary = atob(String(avatar.data));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        avatarPath = `${userId}/avatar`;
        const { error: avatarError } = await adminClient.storage
          .from("avatars")
          .upload(avatarPath, bytes, { contentType: String(avatar.type), upsert: true });
        if (avatarError) {
          return new Response(JSON.stringify({ error: "Não foi possível salvar a imagem" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Não foi possível salvar a imagem" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const updateData: Record<string, unknown> = { name, role, phone, active };
    if (avatarPath !== undefined) {
      updateData.avatar_url = avatarPath;
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Não foi possível atualizar o perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
