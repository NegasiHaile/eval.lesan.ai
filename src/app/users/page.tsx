"use client";

import CopyText from "@/components/utils/CopyText";
import { userDefaultValues } from "@/constants/initial_values";
import { UserTypes } from "@/types/user";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FilterX, Loader2, Pencil, Trash2, X } from "lucide-react";
import Modal from "@/components/utils/Modal";
import Button from "@/components/utils/Button";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import TextInput from "@/components/inputs/TextInput";

const roles = ["root", "admin", "user"];

export default function Page() {
  const [users, setUsers] = useState<UserTypes[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserTypes>({ ...userDefaultValues });
  const [loading, setLoading] = useState<string>("");
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    role: "",
  });
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
    setIsFetchingUsers(true);
    try {
      const res = await fetch("/api/user");

      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const nameMatch = (u.fullName ?? "")
      .toLowerCase()
      .includes(filters.name.toLowerCase());
    const emailMatch = (u.username ?? u.email ?? "")
      .toLowerCase()
      .includes(filters.email.toLowerCase());
    const roleMatch = !filters.role || (u.role ?? "").toLowerCase() === filters.role.toLowerCase();
    return nameMatch && emailMatch && roleMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageEnd = pageStart + rowsPerPage;
  const paginatedUsers = filteredUsers.slice(pageStart, pageEnd);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.name, filters.email, filters.role]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

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
              <tr className="py-0">
                <th />
                <th className="px-2 py-2">
                  <TextInput
                    type="text"
                    name="filter_name"
                    placeholder="Filter by name"
                    value={filters.name}
                    onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                    size="sm"
                    className="w-full"
                  />
                </th>
                <th className="px-2 py-2">
                  <TextInput
                    type="text"
                    name="filter_email"
                    placeholder="Filter by email"
                    value={filters.email}
                    onChange={(e) => setFilters((prev) => ({ ...prev, email: e.target.value }))}
                    size="sm"
                    className="w-full"
                  />
                </th>
                <th className="px-2 py-2">
                  <SelectTransparent
                    name="role_filter"
                    value={filters.role}
                    optionsValues={["", ...roles]}
                    optionsLabels={["All roles", ...roles]}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, role: String(e.target.value) }))
                    }
                    variant="outlined"
                    className="w-full"
                    selectClass="!h-9 !py-1 !px-2 !text-xs "
                  />
                </th>
                <th />
                <th className="px-2 py-2">
                  <Button
                    type="button"
                    variant="secondary"
                    outline
                    size="xs"
                    className="h-8"
                    onClick={() => setFilters({ name: "", email: "", role: "" })}
                    text="Reset"
                  >
                    <FilterX className="size-4 shrink-0" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody className="text-neutral-900 dark:text-neutral-100">
              {isFetchingUsers ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                      <Loader2 className="size-5 animate-spin" />
                      <span>Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-600 dark:text-neutral-300">
                    No users found for the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user: UserTypes, i: number) => {
                  const rowIndex = pageStart + i;
                  return (
                <tr
                  key={`${user.username}-${rowIndex}`}
                  className="border-b last:border-b-0 border-white dark:border-neutral-800"
                >
                  <td className="px-4 py-2">{rowIndex + 1}</td>
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
              );
                })
              )}
            </tbody>
        </table>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 py-3 border border-t-0 rounded-b border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/20">
          <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
            Showing{" "}
            <span className="font-medium">{filteredUsers.length ? pageStart + 1 : 0}</span>
            {" - "}
            <span className="font-medium">{Math.min(pageEnd, filteredUsers.length)}</span>
            {" of "}
            <span className="font-medium">{filteredUsers.length}</span> users
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Rows</span>
              <SelectTransparent
                name="rows_per_page"
                value={rowsPerPage}
                optionsValues={[10, 20, 50, 100]}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                variant="outlined"
                className="min-w-[74px]"
                selectClass="!h-8 !py-1 !px-2 !text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                minimal
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="!px-2"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs sm:text-sm font-mono px-2">
                {currentPage}/{totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                minimal
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="!px-2"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
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
