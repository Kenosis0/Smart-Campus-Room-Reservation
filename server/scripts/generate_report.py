#!/usr/bin/env python3
"""
Smart Campus Room Utilization Report Generator

Generates comprehensive room utilization reports including:
- Total bookings and cancellations per room
- Cancellation rates and trends
- Peak usage hours and days
- Department-wise usage statistics
- Room capacity utilization
- Approval decision statistics
"""

import mysql.connector
from mysql.connector import Error
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict
import os
from dotenv import load_dotenv


class ReportGenerator:
    def __init__(self, host, user, password, database):
        """Initialize database connection"""
        try:
            self.conn = mysql.connector.connect(
                host=host,
                user=user,
                password=password,
                database=database,
                autocommit=True
            )
            self.cursor = self.conn.cursor(dictionary=True)
            print("[✓] Connected to database", file=sys.stderr)
        except Error as e:
            print(f"[✗] Connection failed: {e}", file=sys.stderr)
            raise

    def close(self):
        """Close database connection"""
        if self.conn.is_connected():
            self.cursor.close()
            self.conn.close()

    def query(self, sql, params=None):
        """Execute query and return results"""
        try:
            if params:
                self.cursor.execute(sql, params)
            else:
                self.cursor.execute(sql)
            return self.cursor.fetchall()
        except Error as e:
            print(f"[✗] Query failed: {e}", file=sys.stderr)
            raise

    def get_room_statistics(self):
        """Get booking statistics per room"""
        sql = """
        SELECT
            r.id,
            r.name,
            r.building,
            r.capacity,
            d.name as department,
            COUNT(DISTINCT b.id) as total_bookings,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_bookings,
            SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_bookings,
            SUM(CASE WHEN b.status = 'OVERRIDDEN' THEN 1 ELSE 0 END) as overridden_bookings
        FROM rooms r
        LEFT JOIN departments d ON r.department_id = d.id
        LEFT JOIN bookings b ON r.id = b.room_id
        GROUP BY r.id, r.name, r.building, r.capacity, d.name
        ORDER BY total_bookings DESC
        """
        return self.query(sql)

    def get_peak_hours(self):
        """Get peak usage hours across all bookings"""
        sql = """
        SELECT
            ts.start_time,
            ts.end_time,
            COUNT(DISTINCT bs.booking_id) as booking_count,
            COUNT(DISTINCT CASE WHEN b.status = 'CONFIRMED' THEN bs.booking_id END) as confirmed_count
        FROM time_slots ts
        LEFT JOIN booking_slots bs ON ts.id = bs.time_slot_id
        LEFT JOIN bookings b ON bs.booking_id = b.id
        GROUP BY ts.id, ts.start_time, ts.end_time
        ORDER BY booking_count DESC
        """
        return self.query(sql)

    def get_department_usage(self):
        """Get booking statistics per department"""
        sql = """
        SELECT
            d.id,
            d.name,
            COUNT(DISTINCT b.id) as total_bookings,
            SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_bookings,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_bookings,
            COUNT(DISTINCT r.id) as rooms_owned
        FROM departments d
        LEFT JOIN rooms r ON d.id = r.department_id
        LEFT JOIN bookings b ON r.id = b.room_id
        GROUP BY d.id, d.name
        ORDER BY total_bookings DESC
        """
        return self.query(sql)

    def get_approval_statistics(self):
        """Get approval decision statistics"""
        sql = """
        SELECT
            a.stage,
            a.decision,
            COUNT(*) as count,
            COUNT(CASE WHEN br.emergency_override_requested THEN 1 END) as emergency_override_count
        FROM approvals a
        LEFT JOIN booking_requests br ON a.booking_request_id = br.id
        GROUP BY a.stage, a.decision
        ORDER BY a.stage, a.decision
        """
        return self.query(sql)

    def get_request_statistics(self):
        """Get booking request statistics"""
        sql = """
        SELECT
            status,
            COUNT(*) as count,
            ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)), 2) as avg_hours_to_decision,
            MIN(created_at) as earliest_request,
            MAX(created_at) as latest_request
        FROM booking_requests
        GROUP BY status
        ORDER BY count DESC
        """
        return self.query(sql)

    def get_cancellation_analysis(self):
        """Get analysis of cancellations"""
        sql = """
        SELECT
            COALESCE(r.id, 'UNKNOWN') as room_id,
            COALESCE(r.name, 'UNKNOWN') as room_name,
            COUNT(*) as total_cancellations,
            ROUND(100.0 * COUNT(*) / (
                SELECT COUNT(*) FROM bookings WHERE status IN ('CONFIRMED', 'CANCELLED', 'OVERRIDDEN')
            ), 2) as cancellation_percentage
        FROM bookings b
        LEFT JOIN rooms r ON b.room_id = r.id
        WHERE b.status = 'CANCELLED'
        GROUP BY r.id, r.name
        ORDER BY total_cancellations DESC
        """
        return self.query(sql)

    def get_recent_activity(self, days=7):
        """Get recent booking activity"""
        sql = """
        SELECT
            DATE(request_date) as booking_date,
            COUNT(*) as total_requests,
            SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status IN ('PENDING_DEAN', 'PENDING_ADMIN') THEN 1 ELSE 0 END) as pending
        FROM booking_requests
        WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
        GROUP BY DATE(request_date)
        ORDER BY booking_date DESC
        """
        return self.query(sql, (days,))

    def get_user_activity(self):
        """Get top users by booking requests"""
        sql = """
        SELECT
            u.id,
            u.full_name,
            u.email,
            r.name as role,
            COUNT(DISTINCT br.id) as total_requests,
            SUM(CASE WHEN br.status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_requests,
            SUM(CASE WHEN br.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_requests,
            SUM(CASE WHEN br.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_requests
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN booking_requests br ON u.id = br.requester_user_id
        GROUP BY u.id, u.full_name, u.email, r.name
        ORDER BY total_requests DESC
        """
        return self.query(sql)

    def generate_report(self, report_type='full'):
        """Generate comprehensive report"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'report_type': report_type,
            'sections': {}
        }

        try:
            print("[→] Generating room statistics...", file=sys.stderr)
            report['sections']['room_statistics'] = {
                'title': 'Room Utilization',
                'data': self.get_room_statistics()
            }

            print("[→] Generating peak hours analysis...", file=sys.stderr)
            report['sections']['peak_hours'] = {
                'title': 'Peak Usage Hours',
                'data': self.get_peak_hours()
            }

            print("[→] Generating department usage...", file=sys.stderr)
            report['sections']['department_usage'] = {
                'title': 'Department-wise Usage',
                'data': self.get_department_usage()
            }

            print("[→] Generating approval statistics...", file=sys.stderr)
            report['sections']['approval_statistics'] = {
                'title': 'Approval Decision Statistics',
                'data': self.get_approval_statistics()
            }

            print("[→] Generating request statistics...", file=sys.stderr)
            report['sections']['request_statistics'] = {
                'title': 'Booking Request Status',
                'data': self.get_request_statistics()
            }

            print("[→] Generating cancellation analysis...", file=sys.stderr)
            report['sections']['cancellation_analysis'] = {
                'title': 'Cancellation Analysis',
                'data': self.get_cancellation_analysis()
            }

            print("[→] Generating recent activity...", file=sys.stderr)
            report['sections']['recent_activity'] = {
                'title': 'Recent Activity (Last 7 Days)',
                'data': self.get_recent_activity(7)
            }

            print("[→] Generating user activity...", file=sys.stderr)
            report['sections']['user_activity'] = {
                'title': 'Top Users by Booking Requests',
                'data': self.get_user_activity()
            }

            print("[✓] Report generated successfully", file=sys.stderr)
            return report

        except Exception as e:
            print(f"[✗] Report generation failed: {e}", file=sys.stderr)
            raise

    def generate_summary(self):
        """Generate a quick summary report"""
        summary = {
            'generated_at': datetime.now().isoformat(),
            'report_type': 'summary'
        }

        try:
            # Total statistics
            total_rooms = self.query("SELECT COUNT(*) as count FROM rooms")[0]['count']
            total_bookings = self.query("SELECT COUNT(*) as count FROM bookings")[0]['count']
            confirmed = self.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'CONFIRMED'")[0]['count']
            cancelled = self.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'CANCELLED'")[0]['count']
            total_requests = self.query("SELECT COUNT(*) as count FROM booking_requests")[0]['count']

            summary['totals'] = {
                'rooms': total_rooms,
                'bookings': total_bookings,
                'confirmed': confirmed,
                'cancelled': cancelled,
                'booking_requests': total_requests,
                'cancellation_rate': f"{(cancelled/total_bookings*100):.2f}%" if total_bookings > 0 else "0%"
            }

            # Top room
            top_room = self.query("""
                SELECT r.name, COUNT(*) as booking_count
                FROM rooms r
                LEFT JOIN bookings b ON r.id = b.room_id
                GROUP BY r.id, r.name
                ORDER BY booking_count DESC
                LIMIT 1
            """)[0] if total_rooms > 0 else None

            if top_room:
                summary['top_room'] = top_room

            # Peak time slot
            peak_time = self.query("""
                SELECT ts.start_time, ts.end_time, COUNT(*) as usage_count
                FROM time_slots ts
                LEFT JOIN booking_slots bs ON ts.id = bs.time_slot_id
                GROUP BY ts.id, ts.start_time, ts.end_time
                ORDER BY usage_count DESC
                LIMIT 1
            """)[0] if total_bookings > 0 else None

            if peak_time:
                summary['peak_time'] = peak_time

            return summary

        except Exception as e:
            print(f"[✗] Summary generation failed: {e}", file=sys.stderr)
            raise


def main():
    """Main entry point"""
    # Load environment variables from .env file
    # Try multiple locations to find .env
    possible_paths = [
        os.path.join(os.path.dirname(__file__), '../../.env'),  # From scripts folder
        os.path.join(os.path.dirname(__file__), '../.env'),     # From src folder
        os.path.join(os.path.dirname(__file__), '../../.env'),  # From project root
        '.env'                                                   # Current directory
    ]
    
    env_file = None
    for path in possible_paths:
        if os.path.exists(path):
            env_file = path
            print(f"[✓] Found .env at: {path}", file=sys.stderr)
            break
    
    if env_file:
        load_dotenv(env_file)
    else:
        print("[!] No .env file found, using environment variables", file=sys.stderr)

    # Database configuration
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'smart_campus_reservation')
    }

    # Determine report type from command line
    report_type = sys.argv[1] if len(sys.argv) > 1 else 'full'

    generator = None
    try:
        generator = ReportGenerator(
            db_config['host'],
            db_config['user'],
            db_config['password'],
            db_config['database']
        )

        if report_type == 'summary':
            report = generator.generate_summary()
        else:
            report = generator.generate_report(report_type)

        # Output JSON to stdout
        print(json.dumps(report, indent=2, default=str))

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
    finally:
        if generator:
            generator.close()


if __name__ == '__main__':
    main()
