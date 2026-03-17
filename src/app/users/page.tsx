"use client";

import CopyText from "@/components/utils/CopyText";
import { userDefaultValues } from "@/constants/initial_values";
import { UserTypes } from "@/types/user";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import Modal from "@/components/utils/Modal";
import Button from "@/components/utils/Button";

const roles = ["root", "admin", "user"];

export default function Page() {
  const [users, setUsers] = useState<UserTypes[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserTypes>({ ...userDefaultValues });
  const [loading, setLoading] = useState<string>("");
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: "info" | "success" | "error";
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/user");

      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const requestDeleteUser = (username: string) => {
    setConfirm({
      title: "Delete user",
      message: `Are you sure you want to delete ${username}?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        setLoading("delete");
        try {
          const res = await fetch(`/api/user`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username }),
          });

          if (!res.ok) throw new Error("Failed to delete user");

          const result = await res.json();
          if (result.deletedCount === 1) {
            setUsers((prev) =>
              prev.filter((user) => user.username !== username)
            );
            setNotice({
              title: "User deleted",
              message: `User ${username} deleted successfully.`,
              variant: "success",
            });
          } else {
            setNotice({
              title: "Not found",
              message: `User ${username} not found.`,
              variant: "info",
            });
          }
        } catch (err) {
          console.error("Error deleting user:", err);
          setNotice({
            title: "Delete failed",
            message: "Failed to delete user.",
            variant: "error",
          });
        } finally {
          setLoading("");
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const run = confirm.onConfirm;
    setConfirm(null);
    await run();
  };

  const updateUserRole = async (username: string, role: string) => {
    setLoading("role");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, role }),
      });

      if (!res.ok) throw new Error("Failed to update user role");

      setUsers((prev) =>
        prev.map((user) =>
          user.username === username ? { ...user, role: role } : user
        )
      );
    } catch (err) {
      console.error("Error updating user role:", err);
      setNotice({
        title: "Update failed",
        message: "Failed to update user role.",
        variant: "error",
      });
    } finally {
      setActiveDropdown(null);
    }
    setLoading("");
  };

  const requestAccountStatusChange = (username: string, newStatus: boolean) => {
    setConfirm({
      title: "Change account status",
      message: `Are you sure you want to turn ${newStatus ? "on" : "off"} the account for ${username}?`,
      confirmLabel: "Confirm",
      onConfirm: async () => {
        setLoading("account");
        try {
          const res = await fetch("/api/user", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, active: newStatus }),
          });

          if (!res.ok) throw new Error("Failed to update account status");

          setUsers((prev) =>
            prev.map((user) =>
              user.username === username
                ? { ...user, active: newStatus }
                : user
            )
          );
        } catch (err) {
          console.error("Error updating account status:", err);
          setNotice({
            title: "Update failed",
            message: "Failed to update account status.",
            variant: "error",
          });
        } finally {
          setLoading("");
        }
      },
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="w-full flex flex-col justify-center items-center p-3">
        <div className="w-full h-auto pb-32 max-w-6xl md:pt-6 overflow-x-auto">
          <table className="min-w-full h-full bg-neutral-200/70 dark:bg-neutral-800/50 rounded p-1">
            <thead className="border-b border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
              <tr className="">
                <th className="px-4 py-4 text-left">#</th>
                <th className="px-4 py-4 text-left">Full Name</th>
                <th className="px-4 py-4 text-left">Email</th>
                <th className="px-4 py-4 text-left">Role</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="text-neutral-900 dark:text-neutral-100">
              {users.map((user: UserTypes, i: number) => (
                <tr
                  key={i}
                  className="border-b last:border-b-0 border-white dark:border-neutral-800"
                >
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2">{user.fullName}</td>
                  <td className="px-4 py-2 flex justify-between items-center pr-5">
                    <span> {user.username} </span>
                    <CopyText textToCopy={user.username} />
                  </td>

                  {/* Role Column with Dropdown */}
                  <td className="px-4 py-2">
                    <div className="flex justify-between items-center relative font-mono">
                      {user.role}

                      {loading === "role" &&
                      activeDropdown === user.username ? (
                        <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                      ) : (
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === user.username
                                ? null
                                : user.username
                            )
                          }
                          className="p-1 ml-2 bg-transparent hover:bg-neutral-300 hover:dark:bg-neutral-900/80 rounded cursor-pointer"
                        >
                          {activeDropdown === user.username ? (
                            <X
                              className="size-5"
                            />
                          ) : (
                            <Pencil
                              className="size-5"
                            />
                          )}
                        </button>
                      )}

                      {loading !== "role" &&
                        activeDropdown === user.username && (
                          <div className="absolute z-10 top-full mt-1 right-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded shadow-md w-28">
                            {roles.map((role) => (
                              <button
                                key={role}
                                onClick={() =>
                                  updateUserRole(user.username, role)
                                }
                                className={`w-full text-left px-3 py-2 hover:bg-neutral-300 dark:hover:bg-neutral-800/50 cursor-pointer ${
                                  role === user.role
                                    ? "font-semibold text-blue-600 dark:text-blue-400"
                                    : ""
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </td>

                  {/* Status Column */}
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-lg text-sm font-semibold cursor-pointer uppercase ${
                        user.active
                          ? "bg-green-200 hover:bg-green-500 text-green-500 hover:text-green-50 dark:bg-transparent"
                          : "bg-red-200 hover:bg-red-500 text-red-500 hover:text-red-50 dark:bg-transparent"
                      }`}
                      onClick={() => {
                        setEditUser({ ...user });
                        requestAccountStatusChange(user.username, !user.active);
                      }}
                      title={`Turn ${user.active ? "OFF" : "ON"} ${
                        user.fullName
                      }'s account.`}
                    >
                      {loading === "account" &&
                      editUser.email === user.email ? (
                        <Loader2 className="size-5 animate-spin text-neutral-500" />
                      ) : (
                        <span>{user.active ? "On" : "Off"}</span>
                      )}
                    </button>
                  </td>

                  {/* Actions Column */}
                  <td className="px-4 py-2 space-x-4 flex items-center">
                    <button
                      onClick={() => {
                        setEditUser(user);
                        requestDeleteUser(user.username);
                      }}
                      className="text-red-600 dark:text-red-400 px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-900/80 rounded cursor-pointer"
                      title={`Delete ${user.fullName}'s account`}
                    >
                      {loading === "delete" && editUser.email === user.email ? (
                        <Loader2 className="size-5 animate-spin text-neutral-500" />
                      ) : (
                        <Trash2 className="size-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      <Modal
        isOpen={!!notice}
        setIsOpen={(open) => {
          if (open) return;
          setNotice(null);
        }}
        className="!max-w-md"
      >
        <div className="p-2">
          <h3 className="text-lg font-semibold mb-2">
            {notice?.title ?? "Notice"}
          </h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {notice?.message ?? ""}
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setNotice(null)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirm}
        setIsOpen={(open) => {
          if (open) return;
          setConfirm(null);
        }}
        className="!max-w-md"
      >
        <div className="p-2">
          <h3 className="text-lg font-semibold mb-2">
            {confirm?.title ?? "Confirm"}
          </h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {confirm?.message ?? ""}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              minimal
              size="sm"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!!loading}
              onClick={confirmAction}
            >
              {confirm?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
  );
}
