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
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();
    const role = String(body?.role ?? "tecnico");
    const phone = body?.phone ? String(body.phone).trim() : null;
    const avatar = body?.avatar && typeof body.avatar === "object" ? body.avatar : null;
    const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Nome, e-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }), {
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

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let avatarPath: string | null = null;
    let avatarSaved = true;

    if (newUser.user && avatar) {
      try {
        const binary = atob(String(avatar.data));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        avatarPath = `${newUser.user.id}/avatar`;
        const { error: avatarError } = await adminClient.storage
          .from("avatars")
          .upload(avatarPath, bytes, { contentType: String(avatar.type), upsert: true });
        if (avatarError) {
          avatarPath = null;
          avatarSaved = false;
        }
      } catch {
        avatarPath = null;
        avatarSaved = false;
      }
    }

    if (newUser.user) {
      const { error: profileInsertError } = await adminClient
        .from("profiles")
        .upsert({
          id: newUser.user.id,
          name,
          email,
          role,
          phone,
          avatar_url: avatarPath,
          active: true,
        });

      if (profileInsertError) {
        return new Response(JSON.stringify({ error: "Não foi possível salvar o perfil" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, id: newUser.user?.id, avatarSaved }), {
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
