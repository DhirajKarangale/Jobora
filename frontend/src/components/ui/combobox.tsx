import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Option {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: (string | Option)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
}

export function Combobox({ options, value, onChange, placeholder = "Select...", emptyText = "No option found." }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const normalizedOptions: Option[] = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedLabel = normalizedOptions.find(opt => opt.value === value)?.label || value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal text-left px-3 py-2 bg-background border-border text-sm h-auto")}
      >
        {selectedLabel || placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search...`} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" || value === "all" ? "opacity-100" : "opacity-0"
                  )}
                />
                All
              </CommandItem>
              {normalizedOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
