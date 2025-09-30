//src/components/Calculator/LaborPricingSheet/LaborPricingSheet.jsx

import React, { useState } from 'react';
import styles from './PricingSheet.module.css';

export default function LaborPricingSheet() {
  const [expandedSections, setExpandedSections] = useState(new Set(['bathroom']));
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSection = (section) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      newSet.has(section) ? newSet.delete(section) : newSet.add(section);
      return newSet;
    });
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  // Labor pricing data (Illinois, 2023–2025, mid-range, fair)
  const laborData = {
    kitchen: {
      icon: 'fa-utensils',
      surfaceBased: [
        { type: 'kitchen-flooring', description: 'Install hardwood, tile, vinyl', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'kitchen-backsplash', description: 'Install ceramic, glass tiles', firstFloor: '$10–$20/sqft', secondFloor: '$11.50–$23/sqft' },
        { type: 'kitchen-ceiling', description: 'Install drywall, paint', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'kitchen-cabinets', description: 'Install stock or custom cabinets', firstFloor: '$50–$150/linear ft', secondFloor: '$57.50–$172.50/linear ft' },
        { type: 'kitchen-countertops', description: 'Install granite, quartz', firstFloor: '$20–$50/linear ft', secondFloor: '$23–$57.50/linear ft' },
        { type: 'kitchen-trim', description: 'Install baseboards, molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
      ],
      unitBased: [
        { type: 'kitchen-sink', description: 'Install stainless, composite sink', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'kitchen-faucet', description: 'Install single-handle, touchless', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'kitchen-lighting', description: 'Install pendant, recessed', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'kitchen-appliance', description: 'Install oven, refrigerator', firstFloor: '$150–$400/unit', secondFloor: '$172.50–$460/unit' },
      ],
    },
    bathroom: {
      icon: 'fa-bath',
      surfaceBased: [
        { type: 'bathroom-flooring', description: 'Install tile, vinyl', firstFloor: '$5–$8/sqft', secondFloor: '$5.75–$9.20/sqft' },
        { type: 'bathroom-shower-tiles', description: 'Install mosaic, porcelain', firstFloor: '$10–$25/sqft', secondFloor: '$11.50–$28.75/sqft' },
        { type: 'bathroom-walls', description: 'Install paint, tile', firstFloor: '$2–$10/sqft', secondFloor: '$2.30–$11.50/sqft' },
      ],
      linearFtBased: [
        { type: 'bathroom-vanity', description: 'Install single or double vanity', firstFloor: '$50–$100/linear ft', secondFloor: '$57.50–$115/linear ft' },
        { type: 'bathroom-trim', description: 'Install decorative molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
      ],
      unitBased: [
        { type: 'bathroom-vanity-24-inch', description: 'Install 24-inch vanity', firstFloor: '$200/unit', secondFloor: '$230/unit' },
        { type: 'bathroom-vanity-36-inch', description: 'Install 36-inch vanity', firstFloor: '$300/unit', secondFloor: '$345/unit' },
        { type: 'bathroom-vanity-48-inch', description: 'Install 48-inch vanity', firstFloor: '$400/unit', secondFloor: '$460/unit' },
        { type: 'bathroom-faucet', description: 'Install single-hole, widespread', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'bathroom-toilet', description: 'Install standard, smart toilet', firstFloor: '$150–$350/unit', secondFloor: '$172.50–$402.50/unit' },
        { type: 'bathroom-lighting', description: 'Install vanity, sconce', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'bathroom-bathtub', description: 'Install alcove, freestanding', firstFloor: '$300–$800/unit', secondFloor: '$345–$920/unit' },
      ],
    },
    livingRoom: {
      icon: 'fa-couch',
      surfaceBased: [
        { type: 'living-room-flooring', description: 'Install hardwood, carpet', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'living-room-walls', description: 'Install paint, wallpaper', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'living-room-trim', description: 'Install standard molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
        { type: 'living-room-crown-molding', description: 'Install ornate molding', firstFloor: '$8–$15/linear ft', secondFloor: '$9.20–$17.25/linear ft' },
      ],
      unitBased: [
        { type: 'living-room-lighting', description: 'Install chandelier, recessed', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'living-room-ceiling-fan', description: 'Install standard, smart', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
      ],
    },
    bedroom: {
      icon: 'fa-bed',
      surfaceBased: [
        { type: 'bedroom-flooring', description: 'Install carpet, hardwood', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'bedroom-walls', description: 'Install paint, wallpaper', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'bedroom-trim', description: 'Install standard molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
        { type: 'bedroom-closet-shelves', description: 'Install wire, wood shelves', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
      ],
      unitBased: [
        { type: 'bedroom-lighting', description: 'Install recessed, sconce', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'bedroom-ceiling-fan', description: 'Install standard, smart', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
      ],
    },
    garage: {
      icon: 'fa-warehouse',
      surfaceBased: [
        { type: 'garage-flooring', description: 'Install epoxy, tile', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
        { type: 'garage-walls', description: 'Install drywall, pegboard', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'garage-shelves', description: 'Install wire, metal shelves', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
      ],
      unitBased: [
        { type: 'garage-door', description: 'Install steel, insulated door', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'garage-lighting', description: 'Install LED, motion-sensor', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
      ],
    },
    basement: {
      icon: 'fa-home',
      surfaceBased: [
        { type: 'basement-flooring', description: 'Install carpet, vinyl', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'basement-walls', description: 'Install drywall, waterproof', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'basement-trim', description: 'Install standard molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
      ],
      unitBased: [
        { type: 'basement-lighting', description: 'Install recessed, track', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'basement-window', description: 'Install egress, slider', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
      ],
    },
    laundryRoom: {
      icon: 'fa-tshirt',
      surfaceBased: [
        { type: 'laundry-room-flooring', description: 'Install tile, vinyl', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
      ],
      linearFtBased: [
        { type: 'laundry-room-shelves', description: 'Install wire, wood shelves', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
        { type: 'laundry-room-countertop', description: 'Install laminate, quartz', firstFloor: '$20–$50/linear ft', secondFloor: '$23–$57.50/linear ft' },
      ],
      unitBased: [
        { type: 'laundry-room-sink', description: 'Install utility, stainless sink', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'laundry-room-faucet', description: 'Install single-handle', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
      ],
    },
    hallway: {
      icon: 'fa-door-open',
      surfaceBased: [
        { type: 'hallway-flooring', description: 'Install hardwood, carpet', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'hallway-walls', description: 'Install paint, wallpaper', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'hallway-trim', description: 'Install standard molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
        { type: 'hallway-handrail', description: 'Install wood, metal', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
      ],
      unitBased: [
        { type: 'hallway-lighting', description: 'Install sconce, recessed', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
      ],
    },
    diningRoom: {
      icon: 'fa-utensils',
      surfaceBased: [
        { type: 'dining-room-flooring', description: 'Install hardwood, tile', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
        { type: 'dining-room-walls', description: 'Install paint, wallpaper', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
      ],
      linearFtBased: [
        { type: 'dining-room-trim', description: 'Install standard molding', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
        { type: 'dining-room-crown-molding', description: 'Install ornate molding', firstFloor: '$8–$15/linear ft', secondFloor: '$9.20–$17.25/linear ft' },
      ],
      unitBased: [
        { type: 'dining-room-lighting', description: 'Install chandelier, pendant', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
      ],
    },
    exterior: {
      icon: 'fa-home',
      surfaceBased: [
        { type: 'exterior-painting', description: 'Paint siding, trim', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
        { type: 'exterior-siding', description: 'Install vinyl, brick', firstFloor: '$4–$8/sqft', secondFloor: '$4.60–$9.20/sqft' },
      ],
      linearFtBased: [
        { type: 'exterior-fencing', description: 'Install wood, vinyl fence', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
        { type: 'exterior-gutters', description: 'Install aluminum, copper', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
      ],
      unitBased: [
        { type: 'exterior-door', description: 'Install steel, fiberglass door', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'exterior-lighting', description: 'Install wall-mounted, solar', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
      ],
    },
    electrical: {
      icon: 'fa-bolt',
      surfaceBased: [
        { type: 'electrical-panel-upgrade', description: 'Install 100–400 amp panel', firstFloor: '$10–$20/sqft', secondFloor: '$11.50–$23/sqft' },
        { type: 'electrical-wiring', description: 'Install copper, aluminum wiring', firstFloor: '$5–$10/sqft', secondFloor: '$5.75–$11.50/sqft' },
        { type: 'electrical-ceiling-fan-installation', description: 'Install standard, smart fan', firstFloor: '$5–$8/sqft', secondFloor: '$5.75–$9.20/sqft' },
        { type: 'electrical-recessed-lighting', description: 'Install LED, halogen lights', firstFloor: '$5–$10/sqft', secondFloor: '$5.75–$11.50/sqft' },
      ],
      linearFtBased: [
        { type: 'electrical-conduit-installation', description: 'Install PVC, metal conduit', firstFloor: '$5–$15/linear ft', secondFloor: '$5.75–$17.25/linear ft' },
        { type: 'electrical-cable-run', description: 'Install Cat5, Cat6, coaxial', firstFloor: '$3–$8/linear ft', secondFloor: '$3.45–$9.20/linear ft' },
        { type: 'electrical-baseboard-heater', description: 'Install electric, hydronic heater', firstFloor: '$20–$40/linear ft', secondFloor: '$23–$46/linear ft' },
        { type: 'electrical-under-cabinet-lighting', description: 'Install LED, xenon lighting', firstFloor: '$10–$20/linear ft', secondFloor: '$11.50–$23/linear ft' },
      ],
      unitBased: [
        { type: 'electrical-outlet-installation', description: 'Install standard, GFCI, USB outlet', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'electrical-switch-installation', description: 'Install single-pole, three-way switch', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'electrical-light-fixture-installation', description: 'Install flush-mount, pendant', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'electrical-smoke-detector-installation', description: 'Install battery, hardwired detector', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'electrical-carbon-monoxide-detector', description: 'Install battery, hardwired detector', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'electrical-circuit-breaker', description: 'Install single, double-pole breaker', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'electrical-gfci-outlet', description: 'Install 15–20 amp GFCI outlet', firstFloor: '$120–$200/unit', secondFloor: '$138–$230/unit' },
        { type: 'electrical-usb-outlet', description: 'Install dual-USB, USB-C outlet', firstFloor: '$120–$200/unit', secondFloor: '$138–$230/unit' },
        { type: 'electrical-dimmer-switch', description: 'Install rotary, smart dimmer', firstFloor: '$100–$180/unit', secondFloor: '$115–$207/unit' },
        { type: 'electrical-motion-sensor-switch', description: 'Install infrared, ultrasonic switch', firstFloor: '$120–$200/unit', secondFloor: '$138–$230/unit' },
        { type: 'electrical-smart-switch', description: 'Install WiFi, Zigbee switch', firstFloor: '$150–$250/unit', secondFloor: '$172.50–$287.50/unit' },
        { type: 'electrical-doorbell-installation', description: 'Install wired, wireless doorbell', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'electrical-security-light', description: 'Install motion-sensor, dusk-to-dawn', firstFloor: '$120–$250/unit', secondFloor: '$138–$287.50/unit' },
        { type: 'electrical-flood-light', description: 'Install LED, halogen flood light', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'electrical-wall-sconce', description: 'Install indoor, outdoor sconce', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'electrical-chandelier-installation', description: 'Install single, multi-tier chandelier', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'electrical-thermostat-installation', description: 'Install programmable, smart thermostat', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'electrical-ev-charger-installation', description: 'Install Level 1, Level 2 charger', firstFloor: '$500–$1000/unit', secondFloor: '$575–$1150/unit' },
        { type: 'electrical-surge-protector', description: 'Install whole-house, point-of-use', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'electrical-grounding-rod', description: 'Install copper, galvanized rod', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'electrical-junction-box', description: 'Install plastic, metal box', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'electrical-exhaust-fan', description: 'Install bathroom, kitchen fan', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'electrical-tv-mount-box', description: 'Install recessed, surface-mount box', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'electrical-outdoor-outlet', description: 'Install weatherproof, GFCI outlet', firstFloor: '$120–$250/unit', secondFloor: '$138–$287.50/unit' },
        { type: 'electrical-smart-plug', description: 'Install WiFi, Bluetooth plug', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'electrical-dedicated-circuit', description: 'Install 20–50 amp circuit', firstFloor: '$200–$400/unit', secondFloor: '$230–$460/unit' },
      ],
    },
    plumbing: {
      icon: 'fa-faucet',
      surfaceBased: [
        { type: 'plumbing-pipe-replacement', description: 'Replace copper, PEX, PVC pipes', firstFloor: '$5–$10/sqft', secondFloor: '$5.75–$11.50/sqft' },
        { type: 'plumbing-water-line-installation', description: 'Install copper, PEX water lines', firstFloor: '$5–$12/sqft', secondFloor: '$5.75–$13.80/sqft' },
        { type: 'plumbing-drain-line-installation', description: 'Install PVC, ABS drain lines', firstFloor: '$5–$10/sqft', secondFloor: '$5.75–$11.50/sqft' },
      ],
      linearFtBased: [
        { type: 'plumbing-piping-installation', description: 'Install copper, PEX, PVC piping', firstFloor: '$5–$15/linear ft', secondFloor: '$5.75–$17.25/linear ft' },
        { type: 'plumbing-sewer-line', description: 'Install PVC, cast-iron sewer line', firstFloor: '$10–$25/linear ft', secondFloor: '$11.50–$28.75/linear ft' },
        { type: 'plumbing-gas-line', description: 'Install black-iron, CSST gas line', firstFloor: '$15–$30/linear ft', secondFloor: '$17.25–$34.50/linear ft' },
        { type: 'plumbing-radiant-floor-heating', description: 'Install hydronic, electric heating', firstFloor: '$20–$40/linear ft', secondFloor: '$23–$46/linear ft' },
      ],
      unitBased: [
        { type: 'plumbing-faucet-installation', description: 'Install single-handle, touchless faucet', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'plumbing-shower-head-installation', description: 'Install rain, handheld shower head', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'plumbing-p-trap-installation', description: 'Install PVC, chrome P-trap', firstFloor: '$50–$100/unit', secondFloor: '$57.50–$115/unit' },
        { type: 'plumbing-toilet-installation', description: 'Install one-piece, smart toilet', firstFloor: '$150–$350/unit', secondFloor: '$172.50–$402.50/unit' },
        { type: 'plumbing-sink-installation', description: 'Install undermount, vessel sink', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-garbage-disposal', description: 'Install 1/2–3/4 HP disposal', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-water-heater-installation', description: 'Install tank, tankless heater', firstFloor: '$500–$1000/unit', secondFloor: '$575–$1150/unit' },
        { type: 'plumbing-bathtub-installation', description: 'Install alcove, freestanding tub', firstFloor: '$300–$800/unit', secondFloor: '$345–$920/unit' },
        { type: 'plumbing-shower-valve', description: 'Install thermostatic, pressure valve', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-bidet-installation', description: 'Install standalone, seat bidet', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'plumbing-sump-pump', description: 'Install submersible, pedestal pump', firstFloor: '$300–$600/unit', secondFloor: '$345–$690/unit' },
        { type: 'plumbing-pressure-regulator', description: 'Install adjustable regulator', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-shut-off-valve', description: 'Install ball, gate valve', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'plumbing-angle-stop-valve', description: 'Install quarter-turn valve', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'plumbing-dishwasher-installation', description: 'Install built-in dishwasher', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-washing-machine-valve', description: 'Install single, dual valve', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'plumbing-water-softener', description: 'Install salt-based softener', firstFloor: '$500–$1000/unit', secondFloor: '$575–$1150/unit' },
        { type: 'plumbing-backflow-preventer', description: 'Install pressure preventer', firstFloor: '$200–$400/unit', secondFloor: '$230–$460/unit' },
        { type: 'plumbing-drain-cleanout', description: 'Install indoor, outdoor cleanout', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-expansion-tank', description: 'Install 2–5 gallon tank', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-leak-repair', description: 'Repair with compression, epoxy', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'plumbing-pipe-insulation', description: 'Install foam, fiberglass insulation', firstFloor: '$3–$8/unit', secondFloor: '$3.45–$9.20/unit' },
        { type: 'plumbing-outdoor-spigot', description: 'Install frost-free spigot', firstFloor: '$100–$200/unit', secondFloor: '$115–$230/unit' },
        { type: 'plumbing-kitchen-sprayer', description: 'Install pull-out sprayer', firstFloor: '$80–$150/unit', secondFloor: '$92–$172.50/unit' },
        { type: 'plumbing-bathroom-vent-fan', description: 'Install standard, with-light fan', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
        { type: 'plumbing-water-filter-installation', description: 'Install under-sink, whole-house filter', firstFloor: '$200–$500/unit', secondFloor: '$230–$575/unit' },
        { type: 'plumbing-instant-hot-water-dispenser', description: 'Install electric dispenser', firstFloor: '$150–$300/unit', secondFloor: '$172.50–$345/unit' },
      ],
    },
    general: {
      icon: 'fa-tools',
      surfaceBased: [
        { type: 'general-painting', description: 'Interior, exterior paint', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
        { type: 'general-drywall', description: 'Install standard drywall', firstFloor: '$2–$5/sqft', secondFloor: '$2.30–$5.75/sqft' },
        { type: 'general-flooring', description: 'Install hardwood, carpet', firstFloor: '$4–$7/sqft', secondFloor: '$4.60–$8.05/sqft' },
      ],
      linearFtBased: [
        { type: 'general-trim', description: 'Install standard trim', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
        { type: 'general-baseboards', description: 'Install standard baseboards', firstFloor: '$5–$10/linear ft', secondFloor: '$5.75–$11.50/linear ft' },
      ],
      unitBased: [
        { type: 'general-lighting', description: 'Install recessed, pendant', firstFloor: '$100–$250/unit', secondFloor: '$115–$287.50/unit' },
        { type: 'general-doors', description: 'Install interior, sliding doors', firstFloor: '$150–$400/unit', secondFloor: '$172.50–$460/unit' },
      ],
    },
  };

  // Filter data based on search term
  const filteredData = Object.entries(laborData).reduce((acc, [category, { icon, surfaceBased, linearFtBased, unitBased }]) => {
    const filteredSurface = surfaceBased.filter(item => item.type.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm));
    const filteredLinear = linearFtBased.filter(item => item.type.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm));
    const filteredUnit = unitBased.filter(item => item.type.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm));
    
    if (filteredSurface.length > 0 || filteredLinear.length > 0 || filteredUnit.length > 0) {
      acc[category] = { icon, surfaceBased: filteredSurface, linearFtBased: filteredLinear, unitBased: filteredUnit };
    }
    return acc;
  }, {});

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <i className="fas fa-dollar-sign"></i> Labor Pricing Guide
        </h2>
        <p className={styles.note}>
          Labor charges for home improvement services in Illinois. Second floor rates are 15% higher due to additional effort (e.g., carrying materials upstairs). Use this guide to set fair prices for your customers.
        </p>
        <div className={styles.searchBar}>
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search tasks (e.g., vanity, flooring)"
            value={searchTerm}
            onChange={handleSearch}
            className={styles.searchInput}
          />
        </div>
      </div>
      {Object.entries(filteredData).map(([category, { icon, surfaceBased, linearFtBased, unitBased }]) => (
        <div key={category} className={styles.section}>
          <div className={styles.sectionHeader}>
            <button
              className={styles.toggleButton}
              onClick={() => toggleSection(category)}
              title={expandedSections.has(category) ? 'Collapse' : 'Expand'}
            >
              <i
                className={`fas ${
                  expandedSections.has(category) ? 'fa-chevron-down' : 'fa-chevron-right'
                }`}
              ></i>
            </button>
            <h3 className={styles.sectionTitle}>
              <i className={`fas ${icon}`}></i>{' '}
              {category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')}
            </h3>
          </div>
          {expandedSections.has(category) && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Description</th>
                    <th>First Floor Cost</th>
                    <th>Second Floor Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {surfaceBased.map(({ type, description, firstFloor, secondFloor }) => (
                    <tr key={type}>
                      <td>{type.replace(/-/g, ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}</td>
                      <td>{description}</td>
                      <td>{firstFloor}</td>
                      <td>{secondFloor}</td>
                    </tr>
                  ))}
                  {linearFtBased.map(({ type, description, firstFloor, secondFloor }) => (
                    <tr key={type}>
                      <td>{type.replace(/-/g, ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}</td>
                      <td>{description}</td>
                      <td>{firstFloor}</td>
                      <td>{secondFloor}</td>
                    </tr>
                  ))}
                  {unitBased.map(({ type, description, firstFloor, secondFloor }) => (
                    <tr key={type}>
                      <td>{type.replace(/-/g, ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}</td>
                      <td>{description}</td>
                      <td>{firstFloor}</td>
                      <td>{secondFloor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      {Object.keys(filteredData).length === 0 && (
        <p className={styles.noResults}>No tasks match your search. Try a different term.</p>
      )}
    </div>
  );
}