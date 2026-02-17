"use client";

import Signup from "@/components/Signup";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { VscLoading } from "react-icons/vsc";

const Page = () => {
  const router = useRouter();
  const { user, setUser } = useUser();

  useEffect(() => {
    console.log("user:", user);
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  if (user)
    return (
      <Container className="h-full flex justify-center items-center mt-16">
        <VscLoading className="w-10 h-10 animate-spin text-blue-500" />{" "}
      </Container>
    );

  return (
    <div>
      <Signup
        isOpen={true}
        setIsOpen={() => {
          router.push("/");
        }}
        setUser={setUser}
      />
    </div>
  );
};

export default Page;
