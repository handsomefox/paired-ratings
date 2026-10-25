import { GenericCombobox, type ComboboxFieldProps } from "@/components/generic-combobox";

export function GenreCombobox({ genres, ...props }: ComboboxFieldProps & { genres: string[] }) {
  return (
    <GenericCombobox
      {...props}
      options={genres.map((g) => ({ code: g, name: g }))}
      searchPlaceholder="Search genres..."
      renderLabel={(o) => <span className="truncate">{o.name}</span>}
      emptyText="No genres found."
    />
  );
}
