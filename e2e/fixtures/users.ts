export interface TestUser {
  email: string;
  password: string;
  name: string;
  ghLogin: string;
}

export const users: TestUser[] = [
  {
    email: "octocat@example.com",
    password: "Password123!",
    name: "Octo Cat",
    ghLogin: "octocat",
  },
];

export const primaryUser = users[0];
