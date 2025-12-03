"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Country,
  State,
  City,
  ICountry,
  IState,
  ICity,
} from "country-state-city";
import { MapPin, ChevronDown, Search, X, Check, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import PortalToBody from "@/components/shared/utils/portal-to-body";

export interface UserLocation {
  country: string;
  countryCode: string;
  state: string | null;
  stateCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface LocationSelectorProps {
  value: UserLocation | null;
  onChange: (location: UserLocation | null) => void;
  disabled?: boolean;
  showIdentifyButton?: boolean;
}

type Step = "country" | "state" | "city";

export default function LocationSelector({
  value,
  onChange,
  disabled = false,
  showIdentifyButton = true,
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("country");
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [selectedState, setSelectedState] = useState<IState | null>(null);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Initialize from value
  useEffect(() => {
    if (value?.countryCode) {
      const country = Country.getCountryByCode(value.countryCode);
      if (country) {
        setSelectedCountry(country);
        if (value.stateCode) {
          const state = State.getStateByCodeAndCountry(
            value.stateCode,
            value.countryCode,
          );
          if (state) {
            setSelectedState(state);
          }
        }
      }
    }
  }, [value?.countryCode, value?.stateCode]);

  const countries = useMemo(() => Country.getAllCountries(), []);

  const states = useMemo(() => {
    if (!selectedCountry) return [];
    return State.getStatesOfCountry(selectedCountry.isoCode);
  }, [selectedCountry]);

  const cities = useMemo(() => {
    if (!selectedCountry) return [];
    if (selectedState) {
      return City.getCitiesOfState(
        selectedCountry.isoCode,
        selectedState.isoCode,
      );
    }
    return City.getCitiesOfCountry(selectedCountry.isoCode) || [];
  }, [selectedCountry, selectedState]);

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    if (step === "country") {
      return countries
        .filter((c) => c.name.toLowerCase().includes(searchLower))
        .slice(0, 50);
    }
    if (step === "state") {
      return states
        .filter((s) => s.name.toLowerCase().includes(searchLower))
        .slice(0, 50);
    }
    if (step === "city") {
      return cities
        .filter((c) => c.name.toLowerCase().includes(searchLower))
        .slice(0, 50);
    }
    return [];
  }, [step, search, countries, states, cities]);

  const handleCountrySelect = (country: ICountry) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setSearch("");

    const countryStates = State.getStatesOfCountry(country.isoCode);
    if (countryStates.length > 0) {
      setStep("state");
    } else {
      // No states, go to city or finish
      const countryCities = City.getCitiesOfCountry(country.isoCode) || [];
      if (countryCities.length > 0) {
        setStep("city");
      } else {
        // No cities, just use country
        onChange({
          country: country.name,
          countryCode: country.isoCode,
          state: null,
          stateCode: null,
          city: null,
          latitude: parseFloat(country.latitude) || null,
          longitude: parseFloat(country.longitude) || null,
        });
        setIsOpen(false);
      }
    }
  };

  const handleStateSelect = (state: IState) => {
    setSelectedState(state);
    setSearch("");

    if (!selectedCountry) return;

    const stateCities = City.getCitiesOfState(
      selectedCountry.isoCode,
      state.isoCode,
    );
    if (stateCities.length > 0) {
      setStep("city");
    } else {
      // No cities, use state
      onChange({
        country: selectedCountry.name,
        countryCode: selectedCountry.isoCode,
        state: state.name,
        stateCode: state.isoCode,
        city: null,
        latitude: state.latitude ? parseFloat(state.latitude) : null,
        longitude: state.longitude ? parseFloat(state.longitude) : null,
      });
      setIsOpen(false);
    }
  };

  const handleCitySelect = (city: ICity) => {
    if (!selectedCountry) return;

    onChange({
      country: selectedCountry.name,
      countryCode: selectedCountry.isoCode,
      state: selectedState?.name || null,
      stateCode: selectedState?.isoCode || null,
      city: city.name,
      latitude: city.latitude ? parseFloat(city.latitude) : null,
      longitude: city.longitude ? parseFloat(city.longitude) : null,
    });
    setIsOpen(false);
    setSearch("");
  };

  const handleSkipState = () => {
    if (!selectedCountry) return;

    setSearch("");
    const countryCities =
      City.getCitiesOfCountry(selectedCountry.isoCode) || [];
    if (countryCities.length > 0) {
      setStep("city");
    } else {
      onChange({
        country: selectedCountry.name,
        countryCode: selectedCountry.isoCode,
        state: null,
        stateCode: null,
        city: null,
        latitude: parseFloat(selectedCountry.latitude) || null,
        longitude: parseFloat(selectedCountry.longitude) || null,
      });
      setIsOpen(false);
    }
  };

  const handleSkipCity = () => {
    if (!selectedCountry) return;

    onChange({
      country: selectedCountry.name,
      countryCode: selectedCountry.isoCode,
      state: selectedState?.name || null,
      stateCode: selectedState?.isoCode || null,
      city: null,
      latitude: selectedState?.latitude
        ? parseFloat(selectedState.latitude)
        : parseFloat(selectedCountry.latitude) || null,
      longitude: selectedState?.longitude
        ? parseFloat(selectedState.longitude)
        : parseFloat(selectedCountry.longitude) || null,
    });
    setIsOpen(false);
    setSearch("");
  };

  const handleOpen = () => {
    if (disabled) return;
    setBounds(triggerRef.current?.getBoundingClientRect() ?? null);
    setIsOpen(true);
    setStep("country");
    setSearch("");
    if (!value) {
      setSelectedCountry(null);
      setSelectedState(null);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSelectedCountry(null);
    setSelectedState(null);
  };

  const handleIdentifyLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsIdentifying(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        },
      );

      const { latitude, longitude } = position.coords;

      // Reverse geocode using OpenStreetMap Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      );
      const data = await response.json();

      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.municipality ||
        null;
      const state = data.address?.state || null;
      const country = data.address?.country || "Unknown";
      const countryCode = data.address?.country_code?.toUpperCase() || "XX";

      // Try to find matching country in our database
      const matchedCountry = Country.getCountryByCode(countryCode);

      onChange({
        country: matchedCountry?.name || country,
        countryCode: matchedCountry?.isoCode || countryCode,
        state: state,
        stateCode: null, // We don't get state code from Nominatim
        city: city,
        latitude: latitude,
        longitude: longitude,
      });
    } catch (error) {
      console.error("Error identifying location:", error);
      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          alert("Location access denied. Please enable location permissions.");
        } else if (error.code === error.TIMEOUT) {
          alert("Location request timed out. Please try again.");
        } else {
          alert("Unable to get your location. Please select manually.");
        }
      } else {
        alert("Error identifying location. Please select manually.");
      }
    } finally {
      setIsIdentifying(false);
    }
  };

  const displayValue = value
    ? [value.city, value.state, value.country].filter(Boolean).join(", ")
    : null;

  const getStepTitle = () => {
    if (step === "country") return "Select Country";
    if (step === "state")
      return "Select State in " + (selectedCountry?.name || "");
    return (
      "Select City in " + (selectedState?.name || selectedCountry?.name || "")
    );
  };

  return (
    <div className="flex gap-8">
      {/* Trigger */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={cn(
          "flex-1 flex items-center gap-12 px-16 py-12 rounded-8 border border-border-faint",
          "bg-white hover:border-black-alpha-16 transition-colors cursor-pointer",
          "text-left",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          isOpen && "border-heat-100",
        )}
      >
        <MapPin className="w-16 h-16 text-black-alpha-48 shrink-0" />
        <span
          className={cn(
            "flex-1 text-body-medium truncate",
            !displayValue && "text-black-alpha-40",
          )}
        >
          {displayValue || "Select your location..."}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
            className="p-4 hover:bg-black-alpha-4 rounded-4 transition-colors cursor-pointer"
          >
            <X className="w-14 h-14 text-black-alpha-48" />
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-16 h-16 text-black-alpha-48 transition-transform shrink-0",
            isOpen && "rotate-180",
          )}
        />
      </div>

      {/* Identify Location Button */}
      {showIdentifyButton && (
        <button
          type="button"
          onClick={handleIdentifyLocation}
          disabled={disabled || isIdentifying}
          title="Detect my location"
          className={cn(
            "px-12 py-12 rounded-8 border border-border-faint",
            "bg-white hover:border-black-alpha-16 hover:bg-black-alpha-2 transition-colors",
            "flex items-center justify-center shrink-0",
            (disabled || isIdentifying) && "opacity-50 cursor-not-allowed",
          )}
        >
          {isIdentifying ? (
            <div className="w-16 h-16 border-2 border-black-alpha-32 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Crosshair className="w-16 h-16 text-black-alpha-48" />
          )}
        </button>
      )}

      {/* Dropdown */}
      {isOpen && bounds && (
        <PortalToBody>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[100]" onClick={handleClose} />

          {/* Dropdown Content */}
          <div
            className="fixed z-[101] bg-white rounded-12 border border-border-faint shadow-lg flex flex-col"
            style={{
              top: bounds.bottom + 8,
              left: bounds.left,
              width: bounds.width,
              maxHeight: "400px",
            }}
          >
            {/* Header */}
            <div className="p-12 border-b border-border-faint shrink-0">
              <p className="text-label-small text-black-alpha-56 mb-8">
                {getStepTitle()}
              </p>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-12 top-1/2 -translate-y-1/2 w-16 h-16 text-black-alpha-32" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={"Search " + step + "..."}
                  className="w-full pl-36 pr-12 py-10 rounded-6 border border-border-faint text-body-medium placeholder:text-black-alpha-32 focus:outline-none focus:border-heat-100"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Skip option for state/city */}
              {step === "state" && (
                <button
                  type="button"
                  onClick={handleSkipState}
                  className="w-full px-16 py-12 text-left text-body-small text-heat-100 hover:bg-black-alpha-4 border-b border-border-faint"
                >
                  Skip state selection
                </button>
              )}
              {step === "city" && (
                <button
                  type="button"
                  onClick={handleSkipCity}
                  className="w-full px-16 py-12 text-left text-body-small text-heat-100 hover:bg-black-alpha-4 border-b border-border-faint"
                >
                  Skip city selection
                </button>
              )}

              {filteredItems.length === 0 ? (
                <div className="px-16 py-24 text-center text-body-small text-black-alpha-40">
                  No results found
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected =
                    (step === "country" &&
                      (item as ICountry).isoCode === value?.countryCode) ||
                    (step === "state" &&
                      (item as IState).isoCode === value?.stateCode) ||
                    (step === "city" && (item as ICity).name === value?.city);

                  const key =
                    step === "country"
                      ? (item as ICountry).isoCode
                      : step === "state"
                        ? (item as IState).isoCode
                        : (item as ICity).name + (item as ICity).stateCode;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (step === "country")
                          handleCountrySelect(item as ICountry);
                        else if (step === "state")
                          handleStateSelect(item as IState);
                        else handleCitySelect(item as ICity);
                      }}
                      className={cn(
                        "w-full px-16 py-10 text-left text-body-medium hover:bg-black-alpha-4 flex items-center justify-between",
                        isSelected && "bg-heat-100/5",
                      )}
                    >
                      <span className="flex items-center gap-8">
                        {step === "country" && (
                          <span className="text-body-large">
                            {(item as ICountry).flag}
                          </span>
                        )}
                        <span>{item.name}</span>
                      </span>
                      {isSelected && (
                        <Check className="w-16 h-16 text-heat-100" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Back button */}
            {step !== "country" && (
              <div className="p-12 border-t border-border-faint shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    if (step === "city") {
                      if (states.length > 0) {
                        setStep("state");
                      } else {
                        setStep("country");
                      }
                    } else {
                      setStep("country");
                    }
                    setSearch("");
                  }}
                  className="text-body-small text-black-alpha-56 hover:text-accent-black"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </PortalToBody>
      )}
    </div>
  );
}
