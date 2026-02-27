import { createClient } from "@supabase/supabase-js";

const Auth = () => {

  const supabase = createClient(
    "https://osctrgaoauvpodcyjuku.supabase.co",
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          "https://gokogcpdbeeahkmgjcdaioigcphelkch.chromiumapp.org/"
      }
    });
  }

  return (
    <div>
      <button onClick={login}>Login</button>
    </div>
  );
};

export default Auth;