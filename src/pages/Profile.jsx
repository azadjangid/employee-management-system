import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  CalendarDays,
  MapPin,
  Pencil,
  Save,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import { api } from "../lib/api";
import { useApiQuery, useMutation } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ErrorState, LoadingState } from "../components/common/States";

/** Map the API's employee record to the form fields this page edits. */
function toForm(employee) {
  return {
    firstName: employee.firstName ?? "",
    lastName: employee.lastName ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    department: employee.department ?? "",
    designation: employee.designation ?? "",
    joiningDate: employee.joiningDate ?? "",
    location: employee.location ?? "",
    employeeId: employee.employeeCode,
    status: employee.status,
  };
}

function Profile() {
  const { data, loading, error, reload } = useApiQuery(
    (signal) => api.get("/profile", undefined, { signal }),
    []
  );

  if (loading && !data) {
    return <LoadingState label="Loading your profile..." className="py-32" />;
  }
  if (error && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  return <ProfileContent employee={data} />;
}

function ProfileContent({ employee }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // `saved` is the last version from the server; `profile` holds unsaved edits.
  const [saved, setSaved] = useState(() => toForm(employee));
  const [profile, setProfile] = useState(saved);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const saveProfile = useMutation((body) => api.put("/profile", body));
  const changePassword = useMutation((body) => api.post("/auth/change-password", body));

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const startEditing = () => {
    setProfile(saved);
    setProfileError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setProfile(saved);
    setProfileError("");
    setIsEditing(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.firstName.trim()) {
      setProfileError("First name is required.");
      return;
    }
    setProfileError("");
    try {
      const res = await saveProfile.run({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || null,
        location: profile.location || null,
      });
      const fresh = toForm(res.data);
      setSaved(fresh);
      setProfile(fresh);
      // Keep the name in the navbar / sidebar in sync.
      setUser((u) => ({ ...u, ...res.data }));
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordError("Please fill all password fields.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setPasswordError("");
    try {
      await changePassword.run({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success("Password changed. Other devices have been signed out.");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const togglePassword = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My Profile
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your personal and account information
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={startEditing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Pencil size={17} />
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="h-32 bg-slate-900" />

        <div className="px-5 pb-6 sm:px-8">

          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">

              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-slate-700 text-2xl font-bold text-white shadow-lg">
                {saved.firstName[0]}
                {saved.lastName?.[0]}
              </div>

              <div className="pb-1">

                <h2 className="text-xl font-bold text-slate-900">
                  {saved.firstName} {saved.lastName}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {profile.designation}
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2 pb-1">

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {profile.status}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {profile.employeeId}
              </span>

            </div>

          </div>

        </div>

      </div>

      {/* Personal Information */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">

          <div>
            <h2 className="font-bold text-slate-900">
              Personal Information
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Your basic profile information
            </p>
          </div>

          <User
            size={20}
            className="text-slate-400"
          />

        </div>

        <form
          onSubmit={handleSaveProfile}
          className="p-5 sm:p-6"
        >

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <ProfileInput
              label="First Name"
              name="firstName"
              value={profile.firstName}
              onChange={handleProfileChange}
              disabled={!isEditing}
            />

            <ProfileInput
              label="Last Name"
              name="lastName"
              value={profile.lastName}
              onChange={handleProfileChange}
              disabled={!isEditing}
            />

            <ProfileInput
              label="Email Address"
              name="email"
              value={profile.email}
              onChange={handleProfileChange}
              disabled={!isEditing}
              icon={<Mail size={17} />}
            />

            <ProfileInput
              label="Phone Number"
              name="phone"
              value={profile.phone}
              onChange={handleProfileChange}
              disabled={!isEditing}
              icon={<Phone size={17} />}
            />

            <ProfileInput
              label="Department"
              name="department"
              value={profile.department}
              onChange={handleProfileChange}
              disabled
              icon={<Building2 size={17} />}
            />

            <ProfileInput
              label="Designation"
              name="designation"
              value={profile.designation}
              onChange={handleProfileChange}
              disabled
              icon={<Briefcase size={17} />}
            />

            <ProfileInput
              label="Joining Date"
              name="joiningDate"
              type="date"
              value={profile.joiningDate}
              onChange={handleProfileChange}
              disabled
              icon={<CalendarDays size={17} />}
            />

            <ProfileInput
              label="Location"
              name="location"
              value={profile.location}
              onChange={handleProfileChange}
              disabled={!isEditing}
              icon={<MapPin size={17} />}
            />

          </div>

          {profileError && (
            <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileError}
            </p>
          )}

          {isEditing && (
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saveProfile.pending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saveProfile.pending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                Save Changes
              </button>

            </div>
          )}

        </form>

      </div>

      {/* Employment Information */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">

          <h2 className="font-bold text-slate-900">
            Employment Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Your organization details
          </p>

        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">

          <InfoCard
            label="Employee ID"
            value={profile.employeeId}
            icon={<User size={18} />}
          />

          <InfoCard
            label="Department"
            value={profile.department}
            icon={<Building2 size={18} />}
          />

          <InfoCard
            label="Designation"
            value={profile.designation}
            icon={<Briefcase size={18} />}
          />

          <InfoCard
            label="Joining Date"
            value={formatDate(profile.joiningDate)}
            icon={<CalendarDays size={18} />}
          />

        </div>

      </div>

      {/* Change Password */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Lock size={19} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Change Password
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Update your account password
              </p>
            </div>

          </div>

        </div>

        <form
          onSubmit={handleChangePassword}
          className="space-y-5 p-5 sm:p-6"
        >

          <PasswordInput
            label="Current Password"
            name="currentPassword"
            value={passwordData.currentPassword}
            onChange={handlePasswordChange}
            show={showPasswords.current}
            onToggle={() => togglePassword("current")}
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <PasswordInput
              label="New Password"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              show={showPasswords.new}
              onToggle={() => togglePassword("new")}
            />

            <PasswordInput
              label="Confirm New Password"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              show={showPasswords.confirm}
              onToggle={() => togglePassword("confirm")}
            />

          </div>

          {passwordError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {passwordError}
            </p>
          )}

          <div className="flex justify-end border-t border-slate-200 pt-5">

            <button
              type="submit"
              disabled={changePassword.pending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {changePassword.pending ? <Loader2 size={17} className="animate-spin" /> : <Lock size={17} />}
              Update Password
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

function ProfileInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  disabled,
  icon,
}) {
  return (
    <div>

      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">

        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition ${
            icon ? "pl-10" : ""
          } ${
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
              : "border-slate-300 bg-white text-slate-900 focus:border-slate-500"
          }`}
        />

      </div>

    </div>
  );
}

function PasswordInput({
  label,
  name,
  value,
  onChange,
  show,
  onToggle,
}) {
  return (
    <div>

      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className="relative">

        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 text-sm outline-none focus:border-slate-400"
          placeholder="Enter password"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          {show ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>

      </div>

    </div>
  );
}

function InfoCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>

    </div>
  );
}

export default Profile;