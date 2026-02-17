"use client";

import PrivateRoute from "@/components/PrivateRoute";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";

const Profile = () => {
  const { user } = useUser();

  return (
    <PrivateRoute>
      <Container>
        <div className="w-full flex flex-col justify-center items-center p-3 bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-6xl md:pt-6 font-mono space-y-10">
            <div className="w-full space-y-3">
              {user?.fullName && (
                <p className="text-2xl font-extrabold">[{user.fullName}]</p>
              )}
              <p>
                Email:{" "}
                <span className="lowercase px-2 bg-gray-200/70 dark:bg-gray-800/70 rounded-xl">
                  {user?.username}
                </span>
              </p>
              <p>
                Role:{" "}
                <span className="px-2 bg-gray-200/70 dark:bg-gray-800/70 rounded-xl">
                  {user?.role}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </PrivateRoute>
  );
};

export default Profile;
