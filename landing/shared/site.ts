interface IStore {
  name: string;
  url: string | null;
}

// Set each URL to its confirmed listing to turn its coming-soon card into a link.
export const STORES: IStore[] = [
  { name: 'IzzyOnDroid', url: null },
  { name: 'F-Droid', url: null },
];
