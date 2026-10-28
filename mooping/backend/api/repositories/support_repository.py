from api.entities import SupportRequest


def create(organization_id, user_id, category, message, diagnostic, user_agent):
    return SupportRequest.objects.create(organization_id=organization_id, user_id=user_id, category=category,
                                         message=message, diagnostic=diagnostic, user_agent=user_agent)


def mark_email(support_request, sent_at=None, error=None):
    support_request.email_sent_at = sent_at
    support_request.email_error = error
    support_request.save(update_fields=['email_sent_at', 'email_error'])


def list_by_user(organization_id, user_id, limit):
    return list(SupportRequest.objects.filter(organization_id=organization_id, user_id=user_id)
                .order_by('-created_at')[:limit])
