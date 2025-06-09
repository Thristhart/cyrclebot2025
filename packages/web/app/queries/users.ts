import { getAllUsers } from "@cyrclebot/data";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

const getUsers = createServerFn({
  method: "GET",
}).handler(() => {
  return getAllUsers();
});

export function allUsersQueryOptions() {
  return queryOptions({
    queryKey: ["users"],
    queryFn() {
      return getUsers();
    },
  });
}

export function useAllUsers() {
  return useQuery(allUsersQueryOptions());
}
