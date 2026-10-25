from django.db import models


class User(models.Model):
    name = models.TextField()
    email = models.TextField()
    phone = models.TextField(null=True)
    password_hash = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'

    # DRF permission checks expect these on request.user.
    is_authenticated = True
    is_anonymous = False


class Membership(models.Model):
    pk = models.CompositePrimaryKey('organization_id', 'user_id')
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    user = models.ForeignKey('api.User', on_delete=models.CASCADE)
    role = models.TextField(default='user')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'memberships'


class ApiToken(models.Model):
    token_hash = models.TextField(primary_key=True)
    user = models.ForeignKey('api.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'api_tokens'
