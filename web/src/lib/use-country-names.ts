import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useCountryNames() {
  return useQuery({
    queryKey: ["search-countries"],
    queryFn: api.searchCountries,
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });
}
