import type { Metadata } from 'next';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'Prohibited items' };

export default function ProhibitedItemsPage() {
  return (
    <PolicyPage eyebrow="Off the floor" title="Prohibited items">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>AUCTA is for collectible objects in categories such as watches, cameras, trading cards, sneakers, gaming, vintage electronics, design and art. The following are out of scope for the product and must not be listed. This list is incomplete and requires legal review against Indonesian law and any other launch market.</p>
      <ul>
        <li>Weapons, explosives, and items that require a firearms or similar licence</li>
        <li>Illegal drugs, drug paraphernalia, and stolen or looted property</li>
        <li>Live animals, human remains, and hazardous materials</li>
        <li>Counterfeit goods and items sold as authentic when they are not</li>
        <li>Fiat wallets, stored-value instruments, crypto-assets, and financial securities</li>
        <li>Regulated medical devices and prescription medicines</li>
        <li>Items whose sale is otherwise restricted or requires a licence AUCTA does not hold</li>
      </ul>
      <p>AUCTA may refuse or remove a listing. Refusal is not a finding that an object is lawful or unlawful to own. When in doubt, do not list it.</p>
    </PolicyPage>
  );
}
