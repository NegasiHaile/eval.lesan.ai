"use client";

import PrivateRoute from "@/components/PrivateRoute";
import CopyText from "@/components/utils/CopyText";
import { userDefaultValues } from "@/constants/initial_values";
import { UserTypes } from "@/types/user";
import { useEffect, useState } from "react";
import { VscClose, VscEdit, VscLoading, VscTrash } from "react-icons/vsc";

const roles = ["root", "admin", "user"];

export default function Page() {
  const [users, setUsers] = useState<UserTypes[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserTypes>({ ...userDefaultValues });
  const [loading, setLoading] = useState<string>("");

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

  const deleteUser = async (username: string) => {
    setLoading("delete");
    const confirmed = window.confirm(
      `Are you sure you want to delete ${username}?`
    );
    if (confirmed) {
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
          alert(`User ${username} deleted successfully.`);
          setUsers((prev) => prev.filter((user) => user.username !== username));
        } else {
          alert(`User ${username} not found.`);
        }
      } catch (err) {
        console.error("Error deleting user:", err);
        alert("Failed to delete user.");
      }
    }
    setLoading("");
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
      alert("Failed to update user role.");
    } finally {
      setActiveDropdown(null);
    }
    setLoading("");
  };

  const updateAccountStatus = async (username: string, newStatus: boolean) => {
    setLoading("account");
    const confirmed = window.confirm(
      `Are you sure you want to turn ${
        newStatus ? "on" : "off"
      } the account for ${username}?`
    );
    if (confirmed) {
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
            user.username === username ? { ...user, active: newStatus } : user
          )
        );
      } catch (err) {
        console.error("Error updating account status:", err);
        alert("Failed to update account status.");
      }
    }
    setLoading("");
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <PrivateRoute>
      <div className="w-full flex flex-col justify-center items-center p-3">
        <div className="w-full h-auto pb-32 max-w-6xl md:pt-6 overflow-x-auto">
          <table className="min-w-full h-full bg-gray-200/70 dark:bg-gray-800/50 rounded p-1">
            <thead className="border-b border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              <tr className="">
                <th className="px-4 py-4 text-left">#</th>
                <th className="px-4 py-4 text-left">Full Name</th>
                <th className="px-4 py-4 text-left">Email</th>
                <th className="px-4 py-4 text-left">Role</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 dark:text-gray-100">
              {users.map((user: UserTypes, i: number) => (
                <tr
                  key={i}
                  className="border-b last:border-b-0 border-white dark:border-gray-800"
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
                        <VscLoading className="w-5 h-5 animate-spin text-gray-500" />
                      ) : (
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === user.username
                                ? null
                                : user.username
                            )
                          }
                          className="p-1 ml-2 bg-transparent hover:bg-gray-300 hover:dark:bg-gray-900/80 rounded cursor-pointer"
                        >
                          {activeDropdown === user.username ? (
                            <VscClose
                              className="w-5 h-6"
                              title="Close upadting"
                            />
                          ) : (
                            <VscEdit
                              className="w-5 h-5"
                              title={`Update ${user.fullName}'s role.`}
                            />
                          )}
                        </button>
                      )}

                      {loading !== "role" &&
                        activeDropdown === user.username && (
                          <div className="absolute z-10 top-full mt-1 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded shadow-md w-28">
                            {roles.map((role) => (
                              <button
                                key={role}
                                onClick={() =>
                                  updateUserRole(user.username, role)
                                }
                                className={`w-full text-left px-3 py-2 hover:bg-gray-300 dark:hover:bg-gray-800/50 cursor-pointer ${
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
                        updateAccountStatus(user.username, !user.active);
                      }}
                      title={`Turn ${user.active ? "OFF" : "ON"} ${
                        user.fullName
                      }'s account.`}
                    >
                      {loading === "account" &&
                      editUser.email === user.email ? (
                        <VscLoading className="w-5 h-5 animate-spin text-gray-500" />
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
                        deleteUser(user.username);
                      }}
                      className="text-red-600 dark:text-red-400 px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-900/80 rounded cursor-pointer"
                      title={`Delete ${user.fullName}'s account`}
                    >
                      {loading === "delete" && editUser.email === user.email ? (
                        <VscLoading className="w-5 h-5 animate-spin text-gray-500" />
                      ) : (
                        <VscTrash className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PrivateRoute>
  );
}
