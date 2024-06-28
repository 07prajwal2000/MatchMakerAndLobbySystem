import { z } from "zod";

export const generateTokenRequestSchema = z.object({
  region: z.enum(["AS" , "EU" , "AU" , "US" , "AF"]), // regions: AS - asia, EU - europe, AU - australia, US - north america, AF - africa
  skillRange: z.enum(["1-2" , "3-5" , "6-8" , "9-10"]),
  matchType: z.enum(["4P-R-TANK" , "4P-R-DUST" , "4P-R-TOON" , "4P-UR-TANK" , "4P-UR-DUST" , "4P-UR-TOON"]), 
  // R - ranked, 4P - 4 Player, Maps: Tank, Dust, Toon, UR- UnRanked
});

export type GenerateTokenRequest = z.infer<typeof generateTokenRequestSchema>;