"use client";

import TextInput from "@/components/inputs/TextInput";
import PrivateRoute from "@/components/PrivateRoute";
import Button from "@/components/utils/Button";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";
import { UserTypes } from "@/types/user";
import React, { useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const checkPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[\W_]/.test(password)) strength++;

  if (strength <= 1) return "Weak";
  if (strength === 2 || strength === 3) return "Medium";
  return "Strong";
};

const Profile = () => {
  const { user } = useUser();
  const [userDetail, setUserDetail] = useState<UserTypes | null>(user);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const passwordStrength = checkPasswordStrength(newPassword);

  useEffect(() => {
    if (!user?.username) return;

    const fetchUserDetail = async () => {
      try {
        const res = await fetch(`api/user/${user?.username}`);
        const data = await res.json();
        setUserDetail({ ...data });
      } catch (err) {
        console.error("Failed to fetch user detail:", err);
      }
    };

    fetchUserDetail();
  }, [user?.email]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      return setMessage({
        type: "error",
        text: "All fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return setMessage({ type: "error", text: "Passwords do not match." });
    }

    if (passwordStrength === "Weak") {
      return setMessage({
        type: "error",
        text: "Password is too weak. Please meet all strength requirements.",
      });
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/user/${userDetail?.email}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Password changed successfully." });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({
          type: "error",
          text: data.error || "Password update failed.",
        });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: `${err}` || "Something went wrong.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PrivateRoute>
      <Container>
        <div className="w-full flex flex-col justify-center items-center p-3 bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-6xl md:pt-6 font-mono space-y-10">
            <div className="w-full space-y-3">
              <p className="text-2xl font-extrabold">
                [{userDetail?.fullName}]
              </p>
              <p>
                Email:
                <span className="lowercase px-2 bg-gray-200/70 dark:bg-gray-800/70 rounded-xl">
                  {userDetail?.email}
                </span>
              </p>
              <p>
                User type:
                <span className="px-2 bg-gray-200/70 dark:bg-gray-800/70 rounded-xl">
                  {userDetail?.role}
                </span>
              </p>
            </div>

            {/* Change Password Section */}
            <div className="w-full mt-8 max-w-3xl bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-5">
                Change Your Password
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {[
                  {
                    label: "Old Password",
                    value: oldPassword,
                    onChange: setOldPassword,
                    name: "oldPassword",
                  },
                  {
                    label: "New Password",
                    value: newPassword,
                    onChange: setNewPassword,
                    name: "newPassword",
                  },
                  {
                    label: "Confirm Password",
                    value: confirmPassword,
                    onChange: setConfirmPassword,
                    name: "confirmPassword",
                  },
                ].map((field, i) => (
                  <div key={i}>
                    <label className="block text-sm mb-1">{field.label}</label>
                    <div className="relative">
                      <TextInput
                        type={showPassword ? "text" : "password"}
                        name={field.name}
                        value={field.value}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2/4 -translate-y-2/4 text-gray-500 cursor-pointer"
                      >
                        {showPassword ? (
                          <FaEyeSlash size={18} />
                        ) : (
                          <FaEye size={18} />
                        )}
                      </button>
                    </div>
                    {field.name === "newPassword" && (
                      <div className="text-xs mt-2 text-gray-600 dark:text-gray-300">
                        Strength:{" "}
                        <span
                          className={`font-bold ${
                            passwordStrength === "Weak"
                              ? "text-red-600"
                              : passwordStrength === "Medium"
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {passwordStrength}
                        </span>
                        <ul className="list-disc ml-5 mt-1 text-gray-500 dark:text-gray-400">
                          <li>At least 8 characters</li>
                          <li>Upper and lower case letters</li>
                          <li>At least one number</li>
                          <li>At least one symbol</li>
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {message && (
                  <div
                    className={`p-2 rounded text-sm ${
                      message.type === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <Button
                  type="submit"
                  text={loading ? "Updating..." : "Change Password"}
                  loading={loading}
                  outline
                  className="!font-semibold"
                />
              </form>
            </div>
          </div>
        </div>
      </Container>
    </PrivateRoute>
  );
};

export default Profile;
