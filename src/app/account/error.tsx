'use client';
import { RouteError } from '@/app/_components/route-state';
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) { return <RouteError {...props} title="Your account could not be loaded." />; }
