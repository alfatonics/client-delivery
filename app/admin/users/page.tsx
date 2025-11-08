"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "STAFF" | "CLIENT";
  createdAt: string;
  createdBy?: { id: string; email: string; name: string | null } | null;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<
    string | null
  >(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "CLIENT" as "ADMIN" | "STAFF" | "CLIENT",
  });
  const [editFormData, setEditFormData] = useState({
    email: "",
    name: "",
    role: "CLIENT" as "ADMIN" | "STAFF" | "CLIENT",
  });
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      await fetchUsers();
      setShowForm(false);
      setFormData({
        email: "",
        name: "",
        password: "",
        role: "CLIENT",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({
      email: user.email,
      name: user.name || "",
      role: user.role,
    });
    setError(null);
  };

  const onEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user");
      }

      await fetchUsers();
      setEditingUserId(null);
      setEditFormData({
        email: "",
        name: "",
        role: "CLIENT",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingUserId(userId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }

      await fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const onChangePassword = (userId: string) => {
    setChangingPasswordUserId(userId);
    setPasswordData({ password: "", confirmPassword: "" });
    setError(null);
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUserId) return;

    if (passwordData.password !== passwordData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/users/${changingPasswordUserId}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: passwordData.password }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      setChangingPasswordUserId(null);
      setPasswordData({ password: "", confirmPassword: "" });
      alert("Password changed successfully");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="drive-container">
      <div className="bg-white border-b border-[#dadce0] px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="btn-icon" title="Back">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-normal text-[#202124]">
              Manage Users
            </h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? "btn-secondary" : "btn-primary"}
          >
            {showForm ? "Cancel" : "Create User"}
          </button>
        </div>
      </div>
      <div className="p-6 max-w-[1800px] mx-auto space-y-6">
        {showForm && (
          <form onSubmit={onSubmit} className="card space-y-4">
            <h2 className="text-xl font-normal text-[#202124]">
              Create New User
            </h2>
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-2">
                Name (optional)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-2">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value as "ADMIN" | "STAFF" | "CLIENT",
                  })
                }
                className="input"
              >
                <option value="CLIENT">Client</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </form>
        )}

        {error && !showForm && !editingUserId && !changingPasswordUserId && (
          <div className="card bg-red-50 border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white border border-[#dadce0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8f9fa] border-b border-[#dadce0]">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Email
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Name
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Role
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Created By
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Created
                  </th>
                  <th className="text-left p-3 text-sm font-medium text-[#202124]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#f8f9fa]">
                    {editingUserId === user.id ? (
                      <>
                        <td className="p-3" colSpan={6}>
                          <form
                            onSubmit={onEditSubmit}
                            className="card space-y-3"
                          >
                            <h3 className="font-medium text-[#202124]">
                              Edit User
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-[#5f6368] mb-1">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  required
                                  value={editFormData.email}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      email: e.target.value,
                                    })
                                  }
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[#5f6368] mb-1">
                                  Name
                                </label>
                                <input
                                  type="text"
                                  value={editFormData.name}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      name: e.target.value,
                                    })
                                  }
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[#5f6368] mb-1">
                                  Role
                                </label>
                                <select
                                  value={editFormData.role}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      role: e.target.value as
                                        | "ADMIN"
                                        | "STAFF"
                                        | "CLIENT",
                                    })
                                  }
                                  className="input text-sm"
                                >
                                  <option value="CLIENT">Client</option>
                                  <option value="STAFF">Staff</option>
                                  <option value="ADMIN">Admin</option>
                                </select>
                              </div>
                            </div>
                            {error && editingUserId === user.id && (
                              <p className="text-red-600 text-sm">{error}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary text-sm disabled:opacity-50"
                              >
                                {submitting ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(null);
                                  setError(null);
                                }}
                                className="btn-secondary text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </>
                    ) : changingPasswordUserId === user.id ? (
                      <>
                        <td className="p-3" colSpan={6}>
                          <form
                            onSubmit={onPasswordSubmit}
                            className="card space-y-3"
                          >
                            <h3 className="font-medium text-[#202124]">
                              Change Password
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-[#5f6368] mb-1">
                                  New Password
                                </label>
                                <input
                                  type="password"
                                  required
                                  minLength={6}
                                  value={passwordData.password}
                                  onChange={(e) =>
                                    setPasswordData({
                                      ...passwordData,
                                      password: e.target.value,
                                    })
                                  }
                                  className="input text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[#5f6368] mb-1">
                                  Confirm Password
                                </label>
                                <input
                                  type="password"
                                  required
                                  minLength={6}
                                  value={passwordData.confirmPassword}
                                  onChange={(e) =>
                                    setPasswordData({
                                      ...passwordData,
                                      confirmPassword: e.target.value,
                                    })
                                  }
                                  className="input text-sm"
                                />
                              </div>
                            </div>
                            {error && changingPasswordUserId === user.id && (
                              <p className="text-red-600 text-sm">{error}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary text-sm disabled:opacity-50"
                              >
                                {submitting ? "Changing..." : "Change Password"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setChangingPasswordUserId(null);
                                  setError(null);
                                }}
                                className="btn-secondary text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-sm text-[#202124]">
                          {user.email}
                        </td>
                        <td className="p-3 text-sm text-[#5f6368]">
                          {user.name || "-"}
                        </td>
                        <td className="p-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              user.role === "ADMIN"
                                ? "bg-purple-100 text-purple-800"
                                : user.role === "STAFF"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-[#5f6368]">
                          {user.createdBy?.email || "-"}
                        </td>
                        <td className="p-3 text-sm text-[#5f6368]">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => onEdit(user)}
                              className="px-2 py-1 text-xs btn-secondary"
                              title="Edit user"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onChangePassword(user.id)}
                              className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100"
                              title="Change password"
                            >
                              Password
                            </button>
                            <button
                              onClick={() => onDelete(user.id)}
                              disabled={deletingUserId === user.id}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              title="Delete user"
                            >
                              {deletingUserId === user.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
