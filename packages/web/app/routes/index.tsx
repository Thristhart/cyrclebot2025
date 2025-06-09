import { createFileRoute } from "@tanstack/react-router";
import { allUsersQueryOptions, useAllUsers } from "../queries/users";

export const Route = createFileRoute("/")({
  component: Home,
  async loader({ context }) {
    await context.queryClient.ensureQueryData(allUsersQueryOptions());
  },
});

function Home() {
  const usersQuery = useAllUsers();
  return (
    <ul>
      {usersQuery.data?.map((user) => (
        <li key={user.id}>
          {user.avatar && <img src={user.avatar} alt="" />}
          {user.discord_username}
        </li>
      ))}
    </ul>
  );
}
