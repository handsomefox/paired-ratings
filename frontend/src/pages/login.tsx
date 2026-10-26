import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useId, useState } from "react";

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid password";
    // Too many failed attempts. The backend says when to try again.
    if (error.status === 429) return error.message;
  }
  return "Could not sign in. Try again.";
}

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const passwordId = useId();
  const errorId = useId();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (session) => {
      setError("");
      // The login response is the new session. Caching it before navigating
      // lets the route guard on "/" see it, instead of the stale signed-out one.
      queryClient.setQueryData(queryKeys.session, session);
      void navigate({ to: "/" });
    },
    onError: (err) => setError(loginErrorMessage(err)),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    loginMutation.mutate({ password });
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md border-border/60 bg-card/70 shadow-lg">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <h1 className="text-2xl">Enter password</h1>
            <p className="text-sm text-muted-foreground">
              This library is private to the two of you.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label htmlFor={passwordId} className="sr-only">
              Password
            </label>
            <Input
              id={passwordId}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              Enter
            </Button>
            {error ? (
              <div id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
