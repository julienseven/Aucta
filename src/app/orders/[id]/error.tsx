'use client';
import { RouteError } from '@/app/_components/route-state';
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) { return <RouteError {...props} title="This order could not be loaded." />; }
