import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { withViewTransition } from "@/lib/view-transitions";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      withViewTransition(() => {
        void navigate({ to: "/" });
      });
    },
    onError: () => setError("Invalid password"),
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
            <h1 className="text-2xl font-display">Enter password</h1>
            <p className="text-sm text-muted-foreground">
              This library is private to the two of you.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              type="password"
              name="password"
              placeholder="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              Enter
            </Button>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
