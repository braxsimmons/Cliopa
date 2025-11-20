import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser } from "@/lib/createUser";
import { UserRole } from "@/hooks/useUserRoles";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface CreateUserFormProps {
  onSuccess: () => void;
}

export const CreateUserForm = ({ onSuccess }: CreateUserFormProps) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    team: "",
    hourly_rate: 15,
    start_date: new Date(),
    role: "" as UserRole | "",
    employment_type: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createUser({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        team: formData.team,
        hourly_rate: formData.hourly_rate,
        start_date: formData.start_date,
        role: formData.role,
        employment_type: formData.employment_type
      });

      toast({
        title: "Success",
        description: "User created successfully",
      });

      // Reset form
      setFormData({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        team: "",
        hourly_rate: 15,
        start_date: new Date(),
        role: "",
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      role: prev.role === role ? "" : role,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          value={formData.password}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, password: e.target.value }))
          }
        />
      </div>

      <div>
        <Label htmlFor="first_name">First Name</Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, first_name: e.target.value }))
          }
        />
      </div>

      <div>
        <Label htmlFor="last_name">Last Name</Label>
        <Input
          id="last_name"
          value={formData.last_name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, last_name: e.target.value }))
          }
        />
      </div>

      <div>
        <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
        <Input
          id="hourly_rate"
          type="number"
          step="0.01"
          required
          value={formData.hourly_rate}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              hourly_rate: parseFloat(e.target.value) || 15,
            }))
          }
        />
      </div>

      <div>
        <Label htmlFor="request-type">Team</Label>
        <Select
          value={formData.team}
          onValueChange={(e) => setFormData((prev) => ({ ...prev, team: e }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bisongreen">Bison Green</SelectItem>
            <SelectItem value="boost">Boost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="request-type">Employment Type</Label>
        <Select
          value={formData.employment_type}
          onValueChange={(e) => setFormData((prev) => ({ ...prev, employment_type: e }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Full-Time">Full Time</SelectItem>
            <SelectItem value="Part-Time">Part Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="request-type">Start Date</Label>
        <Input
          id="start_date"
          type="date"
          value={formData.start_date}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, start_date: e.target.value }))
          }
        />
      </div>

      <div>
        <Label>Role</Label>
        <div className="flex gap-2 flex-wrap mt-2">
          {(["admin", "manager", "ccm", "crm"] as UserRole[]).map((role) => (
            <Button
              key={role}
              type="button"
              variant={formData.role === role ? "default" : "outline"}
              size="sm"
              onClick={() => toggleRole(role)}
            >
              {role.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating..." : "Create User"}
      </Button>
    </form>
  );
};
