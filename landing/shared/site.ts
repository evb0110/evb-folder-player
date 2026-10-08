interface IStore {
  name: string;
  url: string | null;
}

// Set each URL to its confirmed listing to turn its in-review card into a link.
export const STORES: IStore[] = [{ name: 'F-Droid', url: null }];
