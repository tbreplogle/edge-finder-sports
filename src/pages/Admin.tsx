import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";

interface UserRecord {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
}

interface Preview {
  id: string;
  sport: string;
  matchup: string;
  start_time: string;
  away_team: string;
  home_team: string;
  away_ml: number | null;
  home_ml: number | null;
  away_edge: number | null;
  home_edge: number | null;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/");
      return;
    }
    const userData = JSON.parse(userStr);
    if (!userData.is_admin) {
      navigate("/");
      return;
    }
    fetchUsers();
    fetchPreviews();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviews = async () => {
    try {
      const res = await fetch("/api/previews/all");
      if (!res.ok) throw new Error("Failed to fetch previews");
      const { previews: data } = await res.json();
      setPreviews(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (user: UserRecord, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <p>Loading admin dashboard...</p>;
  }

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Admin Dashboard</h1>
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <table className="table-auto w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Admin</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2 capitalize">{user.role}</td>
                  <td className="px-4 py-2">{user.is_admin ? "Yes" : "No"}</td>
                  <td className="px-4 py-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Game Previews</h2>
          {previews.length === 0 ? (
            <p>No previews available.</p>
          ) : (
            <table className="table-auto w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Sport</th>
                  <th className="px-4 py-2 text-left">Matchup</th>
                  <th className="px-4 py-2 text-left">Start</th>
                  <th className="px-4 py-2 text-left">Away ML</th>
                  <th className="px-4 py-2 text-left">Home ML</th>
                  <th className="px-4 py-2 text-left">Away Edge</th>
                  <th className="px-4 py-2 text-left">Home Edge</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2 uppercase">{p.sport}</td>
                    <td className="px-4 py-2">{p.away_team} @ {p.home_team}</td>
                    <td className="px-4 py-2">{p.start_time}</td>
                    <td className="px-4 py-2">{p.away_ml ?? "N/A"}</td>
                    <td className="px-4 py-2">{p.home_ml ?? "N/A"}</td>
                    <td className="px-4 py-2">{p.away_edge ?? "N/A"}</td>
                    <td className="px-4 py-2">{p.home_edge ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default Admin;
