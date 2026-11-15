import { Link, NavLink } from 'react-router';

import { useWishlist } from '@/features/wishlist/use-wishlist';
import { pluralize } from '@/lib/format';

import { SITE_NAME } from '../head';

export function Header() {
  const count = useWishlist().length;

  return (
    <header className="app__header">
      <Link className="app__logo" to="/">
        {SITE_NAME}
      </Link>
      <nav className="app__nav" aria-label="Main">
        <NavLink
          className="app__nav-link"
          to="/wishlist"
          aria-label={`Wish list, ${pluralize(count, 'film')}`}
        >
          Wish list{' '}
          <span className="app__badge" aria-hidden="true">
            {count}
          </span>
        </NavLink>
      </nav>
    </header>
  );
}
