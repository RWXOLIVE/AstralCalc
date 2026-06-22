window.FRAG_SPLIT_RULES = {
	/*
	 * Split boundaries are inclusive by index:
	 * - Any fight with index <= endIndex (or <= the highest index found in endTrainers)
	 *   will be counted in that split.
	 * - Any fight after the last configured boundary falls into the next split.
	 *
	 * You can configure either:
	 *   1) endIndex: number
	 *   2) endTrainers: string or string[] of trainer labels from set data
	 */
	boundaries: [
		{
			split: 1,
			endTrainers: [
				"Leader Roxanne | Rustboro Gym",
				"Leader Brock | Rustboro Gym"
			]
		},
		{
			split: 2,
			endTrainers: [
				"Leader Brawly | Dewford Gym"
			]
		},
		{
			split: 3,
			endTrainers: [
				"Gym Leader Norman | Petalburg Gym",
				"Gym Leader Norman - DB | Petalburg Gym"
			]
		},
		{
			split: 4,
			endTrainers: [
				"Leader Elesa | Mauville Gym",
				"Leader Jasmine | Mauville Gym"
			]
		},
		{
			split: 5,
			endTrainers: [
				"Blaine & Flannery | Lavaridge Gym",
			]
		},
	]
};
