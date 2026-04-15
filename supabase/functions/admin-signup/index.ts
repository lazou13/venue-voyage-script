import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AdminSignupRequest {
  email: string
  password: string
  adminCode: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, password, adminCode }: AdminSignupRequest = await req.json()

    // Validate input
    if (!email || !password || !adminCode) {
      console.log('Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Email, mot de passe et code admin requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin code
    const ADMIN_CODE = Deno.env.get('ADMIN_SIGNUP_CODE')
    if (!ADMIN_CODE) {
      console.error('ADMIN_SIGNUP_CODE not configured')
      return new Response(
        JSON.stringify({ error: 'Configuration serveur manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (adminCode !== ADMIN_CODE) {
      console.log('Invalid admin code provided')
      return new Response(
        JSON.stringify({ error: 'Code admin invalide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create user with email confirmation disabled
    console.log('Creating admin user:', email)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email
    })

    if (createError) {
      console.error('Error creating user:', createError.message)
      
      if (createError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Cet email est déjà enregistré' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userData.user) {
      console.error('User creation returned no user')
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du compte' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Assign admin role
    console.log('Assigning admin role to user:', userData.user.id)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: 'admin'
      })

    if (roleError) {
      console.error('Error assigning role:', roleError.message)
      // User was created but role assignment failed - still return success
      // The user exists but won't have admin access until role is fixed
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: 'Compte créé mais rôle non assigné. Contactez un administrateur.',
          user: { id: userData.user.id, email: userData.user.email }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user created successfully:', userData.user.email)
    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userData.user.id, email: userData.user.email }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
