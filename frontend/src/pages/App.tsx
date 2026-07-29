import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { apiRequest } from "../lib/api";

type Profile = {
  id: string;
  username: string;
  role: "owner" | "teacher" | "student";
  programs: { italian: boolean; portfolio: boolean };
};

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("工业级迁移版：认证与后端 API 骨架已就绪");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        loadProfile().catch((error) => setStatus(error.message));
      }
    });
  }, []);

  async function signIn() {
    try {
      setStatus("登录中...");
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setStatus(error.message);
        return;
      }
      await loadProfile();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登录失败，请稍后重试");
    }
  }

  async function loadProfile() {
    const data = await apiRequest<{ profile: Profile }>("/me");
    setProfile(data.profile);
    setStatus("已连接安全后端");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setStatus("已退出");
  }

  return (
    <main className="shell">
      <h1>A1 STUDIO暑期打卡</h1>
      <p className="muted">
        这是前后端分离迁移版入口。当前线上 PWA v21 已保留，正式 App 将逐步迁移到 Supabase
        Auth + Edge Functions + RLS 架构。
      </p>

      <section className="panel">
        {profile ? (
          <>
            <h2>{profile.username}</h2>
            <p className="muted">角色：{profile.role}</p>
            <p className="muted">
              课程：{profile.programs.italian ? "意大利语 " : ""}
              {profile.programs.portfolio ? "作品集" : ""}
            </p>
            <button className="button" onClick={signOut}>
              退出
            </button>
          </>
        ) : (
          <>
            <h2>安全登录</h2>
            <p className="muted">正式版使用 Supabase Auth。教师创建学生后，学生使用邮箱/密码登录。</p>
            <input placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input
              placeholder="密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button className="button" onClick={signIn}>
              登录
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <strong>状态</strong>
        <p className="muted">{status}</p>
      </section>
    </main>
  );
}
