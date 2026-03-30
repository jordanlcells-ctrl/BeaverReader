// Supabase Edge Function: delete-account
// Deletes all user data and then removes the auth user.
// Must be called with a valid user JWT. Uses the service-role key server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller's JWT to get their user ID
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Use service-role client to delete data and auth user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Delete user data in dependency order
    // Cards first (depend on decks), then decks, then books, highlights, bookmarks
    await supabaseAdmin.from('cards').delete().eq('user_id', userId);
    await supabaseAdmin.from('decks').delete().eq('user_id', userId);
    await supabaseAdmin.from('highlights').delete().eq('user_id', userId);
    await supabaseAdmin.from('bookmarks').delete().eq('user_id', userId);

    // Delete stored book files from storage
    const { data: books } = await supabaseAdmin
      .from('books')
      .select('file_path')
      .eq('user_id', userId);

    if (books && books.length > 0) {
      const filePaths = books.map((b: { file_path: string }) => b.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        await supabaseAdmin.storage.from('books').remove(filePaths);
      }
    }

    await supabaseAdmin.from('books').delete().eq('user_id', userId);

    // Finally, delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account. Please contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
