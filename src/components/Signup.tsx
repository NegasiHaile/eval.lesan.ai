"use client";
import { Dispatch, useState, SetStateAction } from "react";
import Modal from "./utils/Modal";
import { UserTypes } from "@/types/user";
import { useRouter } from "next/navigation";
import { userDefaultValues } from "@/constants/initial_values";
import TextInput from "./inputs/TextInput";
import Button from "./utils/Button";
import Checkbox from "./inputs/Checkbox";

type ModalProps = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<UserTypes | null>>;
};

type authScreenType = "Sign In" | "Sign Up" | "Reset Password";

export default function Signup({ isOpen, setIsOpen, setUser }: ModalProps) {
  const router = useRouter();
  const [authScreen, setAuthScreen] = useState<authScreenType>("Sign In");
  const [userDetail, setUserDetail] = useState<UserTypes>({
    ...userDefaultValues,
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const resetFields = () => {
    setUserDetail(userDefaultValues);
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    try {
      userDetail.email = userDetail.username; // Temporarly

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userDetail }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Signup failed.");
        setLoading(false);
        return;
      }

      resetFields();
      setIsOpen(false);
      setLoading(false);
      router.push("/");
      alert(
        data.message ??
          "We sent an email confirmation to your email, Please confirm your email!"
      );
    } catch (err) {
      console.error("Signup error:", err);
      alert("An error occurred during signup.");
      setLoading(false);
    }
  };

  const handleSignin = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userDetail.username,
          password: userDetail.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Sign-in failed.");
        setLoading(false);
        return;
      }

      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
      resetFields();
      setIsOpen(false);
      setLoading(false);
      router.push("/");
    } catch (err) {
      console.error("Signin error:", err);
      setLoading(false);
      alert("An error occurred during sign-in.");
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userDetail.username }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Request failed.");
      } else {
        alert(data.message);
        setAuthScreen("Sign In");
        resetFields();
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      alert("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen}>
      <form
        onSubmit={
          authScreen === "Sign In"
            ? handleSignin
            : authScreen === "Sign Up"
            ? handleSignup
            : handleForgotPassword
        }
        className="p-6 rounded w-full md:min-w-lg"
      >
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
          {authScreen}
        </h2>

        {authScreen.toLowerCase() === "Sign Up".toLowerCase() && (
          <div className="mb-4">
            <label className="block text-gray-800 dark:text-gray-200 mb-1">
              Full Name
            </label>
            <TextInput
              type="text"
              name="fullName"
              value={userDetail.fullName ?? ""}
              required={true}
              onChange={(e) =>
                setUserDetail((prev) => ({ ...prev, fullName: e.target.value }))
              }
              placeholder="Enter your full name"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-800 dark:text-gray-200 mb-1">
            Email
          </label>
          <TextInput
            type="text"
            name="email"
            value={userDetail.username}
            required={true}
            onChange={(e) =>
              setUserDetail((prev) => ({ ...prev, username: e.target.value }))
            }
            placeholder="Enter your email"
          />
        </div>

        {authScreen !== "Reset Password" && (
          <div className="mb-6">
            <label className="block text-gray-800 dark:text-gray-200 mb-1">
              Password
            </label>
            <TextInput
              type={showPassword ? "text" : "password"}
              name="password"
              value={userDetail.password}
              required={true}
              onChange={(e) =>
                setUserDetail((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="Enter password"
            />
            <div className="pt-3 text-sm flex flex-wrap items-center space-x-2 justify-between">
              <Checkbox
                label={"Show password"}
                checked={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              />

              {authScreen === "Sign In" && (
                <p className="flex flex-wrap">
                  Forgot your password?
                  <span
                    onClick={() => {
                      setAuthScreen("Reset Password");
                      resetFields();
                    }}
                    className="text-blue-600 hover:underline cursor-pointer px-1"
                  >
                    Reset Here
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          text={authScreen}
          variant="primary"
          outline={true}
          loading={loading}
        />

        <p className="mt-4 text-center text-gray-700 dark:text-gray-300">
          {authScreen === "Sign In" && (
            <>
              Don’t have an account?{" "}
              <span
                onClick={() => {
                  resetFields();
                  setAuthScreen("Sign Up");
                }}
                className="text-blue-600 hover:underline cursor-pointer"
              >
                Sign up
              </span>
            </>
          )}

          {authScreen === "Sign Up" && (
            <>
              Already have an account?{" "}
              <span
                onClick={() => {
                  resetFields();
                  setAuthScreen("Sign In");
                }}
                className="text-blue-600 hover:underline cursor-pointer"
              >
                Sign in
              </span>
            </>
          )}

          {authScreen === "Reset Password" && (
            <>
              You remember your password?{" "}
              <span
                onClick={() => {
                  resetFields();
                  setAuthScreen("Sign In");
                }}
                className="text-blue-600 hover:underline cursor-pointer"
              >
                Sign in
              </span>
            </>
          )}
        </p>
      </form>
    </Modal>
  );
}
