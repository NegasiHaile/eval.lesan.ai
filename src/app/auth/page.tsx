"use client";

import Signup from "@/components/Signup";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

const Page = () => {
  const router = useRouter();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  if (user)
    return (
      <Container className="h-full flex justify-center items-center mt-16">
        <Loader2 className="size-10 animate-spin text-blue-500" />{" "}
      </Container>
    );

  return (
    <div>
      <Signup
        isOpen={true}
        setIsOpen={() => {
          router.push("/");
        }}
      />
    </div>
  );
};

export default Page;
